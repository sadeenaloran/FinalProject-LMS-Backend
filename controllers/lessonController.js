import LessonModel from "../models/Lesson.js";
import ModuleModel from "../models/Module.js";
import CourseModel from "../models/Course.js";
import AssignmentModel from "../models/Assignment.js";
import {
  createLessonSchema,
  updateLessonSchema,
} from "../utils/lessonValidation.js";
import { uploadToCloudinary } from "../config/cloudinary.js";

const LessonController = {
  // async createLesson(req, res, next) {
  //   try {
  //     const { error, value } = createLessonSchema.validate(req.body);
  //     if (error) {
  //       return res
  //         .status(400)
  //         .json({ success: false, message: error.details[0].message });
  //     }

  //     const { module_id, title, content_type, content_url, duration, order } =
  //       req.body;

  //     const module = await ModuleModel.findById(module_id);
  //     if (!module) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "Module not found",
  //       });
  //     }

  //     const course = await CourseModel.findById(module.course_id);

  //     if (req.user.id !== course.instructor_id) {
  //       return res.status(403).json({
  //         success: false,
  //         message: "Only the instructor of this course can create lessons",
  //       });
  //     }

  //     const lesson = await LessonModel.create({
  //       module_id,
  //       title,
  //       content_type,
  //       content_url,
  //       duration,
  //       order,
  //     });

  //     res.status(201).json({
  //       success: true,
  //       lesson,
  //     });
  //   } catch (error) {
  //     next(error);
  //   }
  // },

  async createLesson(req, res, next) {
    try {
      console.log("📦 req.body:", req.body);
      console.log("📂 req.file:", req.file);

      req.body.module_id = Number(req.body.module_id);
      req.body.duration = Number(req.body.duration);
      req.body.order = Number(req.body.order);

      // تعديل createLessonSchema ليجعل content_url اختياري لو content_type = video
      // (يجب تعديل السكيمة نفسها كما ذكرت لك سابقًا في ملف validation)

      // التحقق من صحة البيانات بعد التحويل
      const { error, value } = createLessonSchema.validate(req.body);

      if (error) {
        console.log("❌ Validation error:", error.details[0].message);
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }

      const { module_id, title, content_type, duration, order } = value;
      let { content_url } = value;

      if (content_type === "video" || content_type === "document") {
        if (!req.file && !content_url) {
          return res.status(400).json({
            success: false,
            message: "Video file or content_url is required for video lessons",
          });
        }

        if (req.file) {
          const result = await uploadToCloudinary(req.file.buffer, {
            resource_type: content_type === "video" ? "video" : "auto",
          });

          if (!result?.secure_url) {
            return res.status(400).json({
              success: false,
              message: "Failed to upload video to Cloudinary",
              cloudinaryResponse: result,
            });
          }
          content_url = result.secure_url;
        }
      }

      const module = await ModuleModel.findById(module_id);
      if (!module) {
        return res.status(404).json({
          success: false,
          message: "Module not found",
        });
      }

      const course = await CourseModel.findById(module.course_id);
      if (req.user.id !== course.instructor_id) {
        return res.status(403).json({
          success: false,
          message: "Only the instructor of this course can create lessons",
        });
      }

      const lesson = await LessonModel.create({
        module_id,
        title,
        content_type,
        content_url,
        duration,
        order,
      });

      return res.status(201).json({
        success: true,
        lesson,
      });
    } catch (error) {
      next(error);
    }
  },

  async getLesson(req, res, next) {
    try {
      const lesson = await LessonModel.findByIdWithDetails(req.params.id);
      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: "Lesson not found",
        });
      }

      const assignments = await AssignmentModel.findByLessonId(req.params.id);

      res.json({
        success: true,
        lesson: {
          ...lesson,
          assignments,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getLessonsByModule(req, res, next) {
    try {
      const lessons = await LessonModel.findByModuleId(req.params.moduleId);
      res.json({
        success: true,
        data: lessons,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateLesson(req, res, next) {
    try {
      const { error, value } = updateLessonSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }
      const lesson = await LessonModel.findById(req.params.id);
      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: "Lesson not found",
        });
      }

      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      if (req.user.id !== course.instructor_id) {
        return res.status(403).json({
          success: false,
          message: "Only the instructor of this course can update lessons",
        });
      }

      const updatedLesson = await LessonModel.update(req.params.id, {
        title: req.body.title,
        content_type: req.body.content_type,
        content_url: req.body.content_url,
        duration: req.body.duration,
        order: req.body.order,
      });

      res.json({
        success: true,
        lesson: updatedLesson,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteLesson(req, res, next) {
    try {
      const lesson = await LessonModel.findById(req.params.id);
      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: "Lesson not found",
        });
      }

      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      if (req.user.role !== "admin" && course.instructor_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to delete this lesson",
        });
      }

      await LessonModel.delete(req.params.id);
      res.json({
        success: true,
        message: "Lesson deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};

export default LessonController;
