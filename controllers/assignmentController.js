import AssignmentModel from "../models/Assignment.js";
import LessonModel from "../models/Lesson.js";
import ModuleModel from "../models/Module.js";
import CourseModel from "../models/Course.js";
import { pool } from "../config/db.js"; 

import { getCourseFromAssignment } from "../utils/helpers.js";
import {
  assignmentCreateSchema,
  assignmentUpdateSchema,
} from "../utils/assignmentValidation.js";

const AssignmentController = {
  async createAssignment(req, res, next) {
    try {
      const { error, value } = assignmentCreateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((err) => err.message),
        });
      }
      const { lesson_id, title, description, max_score } = value;

      const lesson = await LessonModel.findById(lesson_id);
      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: "Lesson not found",
        });
      }

      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      if (course.instructor_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Only instructor can create assignments for this course",
        });
      }

      const assignment = await AssignmentModel.create({
        lesson_id,
        title,
        description,
        max_score,
      });

      res.status(201).json({
        success: true,
        assignment,
      });
    } catch (error) {
      next(error);
    }
  },

  async getAssignment(req, res, next) {
    try {
      const assignment = await AssignmentModel.findById(req.params.id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: "Assignment not found",
        });
      }

      res.json({
        success: true,
        assignment,
      });
    } catch (error) {
      next(error);
    }
  },

  async getAssignmentsByLesson(req, res, next) {
    try {
      const assignments = await AssignmentModel.findByLessonId(
        req.params.lessonId
      );
      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateAssignment(req, res, next) {
    try {
      const { error, value } = assignmentUpdateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((err) => err.message),
        });
      }
      const assignment = await AssignmentModel.findById(req.params.id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: "Assignment not found",
        });
      }

      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      if (course.instructor_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Only instructor can update this assignment",
        });
      }

      const updatedAssignment = await AssignmentModel.update(req.params.id, {
        title: req.body.title,
        description: req.body.description,
        max_score: req.body.max_score,
      });

      res.json({
        success: true,
        assignment: updatedAssignment,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteAssignment(req, res, next) {
    try {
      const assignment = await AssignmentModel.findById(req.params.id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: "Assignment not found",
        });
      }

      const course = await getCourseFromAssignment(req.params.id);

      if (req.user.role !== "admin" && course.instructor_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to delete this assignment",
        });
      }

      await AssignmentModel.delete(req.params.id);
      res.json({
        success: true,
        message: "Assignment deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
  async getInstructorCoursesWithHierarchy(req, res, next) {
    try {
      const instructorId = req.user.id;

      const courses = await CourseModel.findByInstructor(instructorId);

      const result = await Promise.all(
        courses.map(async (course) => {
          const modules = await ModuleModel.findByCourseId(course.id);

          const modulesWithLessons = await Promise.all(
            modules.map(async (module) => {
              const lessons = await LessonModel.findByModuleId(module.id);

              return {
                ...module, 
                lessons,
              };
            })
          );

          return {
            ...course,
            modules: modulesWithLessons,
          };
        })
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error in getInstructorCoursesWithHierarchy:", error);
      next(error);
    }
  },
  getInstructorAssignments: async (req, res, next) => {
    try {
      const instructorId = req.user.id;

      const courses = await CourseModel.findByInstructor(instructorId);

      const allLessons = await Promise.all(
        courses.map(async (course) => {
          const modules = await ModuleModel.findByCourseId(course.id);
          const lessons = await Promise.all(
            modules.map((module) => LessonModel.findByModuleId(module.id))
          );
          return lessons.flat();
        })
      );

      const lessonIds = allLessons.flat().map((lesson) => lesson.id);

      if (lessonIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const assignments = await AssignmentModel.findDetailedByLessonIds(
        lessonIds
      );

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      console.error("Error in getInstructorAssignments:", error);
      next(error); 
    }
  },
  async getAssignmentsByCourse(req, res, next) {
    try {
      const { courseId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const course = await CourseModel.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      if (userRole === "student") {
        const { rows } = await pool.query(
          `SELECT id FROM enrollments 
           WHERE user_id = $1 AND course_id = $2`,
          [userId, courseId]
        );
        if (rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: "You are not enrolled in this course",
          });
        }
      } else if (userRole === "instructor" && course.instructor_id !== userId) {
        return res.status(403).json({
          success: false,
          message: "You are not the instructor of this course",
        });
      }

      const assignments = await AssignmentModel.findByCourseId(courseId);

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      console.error("Error in getAssignmentsByCourse:", error);
      next(error);
    }
  },
};

export default AssignmentController;
