import Joi from "joi";

const phoneRegex = /^\d{10,12}$/;
const maxFileSize = 16 * 1024 * 1024; // 16MB limit for media files

// Let me think about the supported MIME types...
const supportedMimeTypes = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/3gpp", "video/quicktime"],
  audio: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/m4a"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

export const WhatsAppvalidators = {
  // Previous validators remain unchanged...
  textMessage: Joi.object({
    phone: Joi.string().pattern(phoneRegex).required().messages({
      "string.pattern.base": "Phone number must be between 10 and 12 digits",
      "any.required": "Phone number is required",
    }),
    message: Joi.string().required().min(1).max(4096).messages({
      "string.min": "Message cannot be empty",
      "string.max": "Message cannot exceed 4096 characters",
      "any.required": "Message is required",
    }),
  }),
  // Sticker validation
  sticker: Joi.object({
    phone: Joi.string().pattern(phoneRegex).required().messages({
      "string.pattern.base": "Phone number must be between 10 and 12 digits",
      "any.required": "Phone number is required",
    }),
  }),
  // New unified media validation
  media: Joi.object({
    // Basic requirements
    phone: Joi.string().pattern(phoneRegex).required().messages({
      "string.pattern.base": "Phone number must be between 10 and 12 digits",
      "any.required": "Phone number is required",
    }),

    // Media type specification
    mediaType: Joi.string()
      .valid("image", "video", "audio", "document")
      .required()
      .messages({
        "any.only": "Media type must be one of: image, video, audio, document",
        "any.required": "Media type is required",
      }),

    // File validation
    file: Joi.object({
      fieldname: Joi.string().required(),
      originalname: Joi.string().required(),
      encoding: Joi.string().required(),
      mimetype: Joi.string()
        .custom((value, helpers) => {
          const mediaType = helpers.state.ancestors[0].mediaType as
            | "image"
            | "video"
            | "audio"
            | "document";
          if (!supportedMimeTypes[mediaType]?.includes(value)) {
            return helpers.error("any.invalid", {
              message: `Invalid file type for ${mediaType}. Supported types: ${supportedMimeTypes[
                mediaType
              ]?.join(", ")}`,
            });
          }
          return value;
        })
        .required(),
      size: Joi.number()
        .max(maxFileSize)
        .required()
        .messages({
          "number.max": `File size cannot exceed ${
            maxFileSize / (1024 * 1024)
          }MB`,
        }),
      buffer: Joi.binary().required(),
    }).required(),

    // Optional parameters
    caption: Joi.string().max(1024).optional().messages({
      "string.max": "Caption cannot exceed 1024 characters",
    }),

    // Media-specific options
    options: Joi.object({
      // Image specific
      viewOnce: Joi.when("mediaType", {
        is: "image",
        then: Joi.boolean().optional().default(false),
      }),

      // Video specific
      gifPlayback: Joi.when("mediaType", {
        is: "video",
        then: Joi.boolean().optional().default(false),
      }),

      // Document specific
      filename: Joi.when("mediaType", {
        is: "document",
        then: Joi.string().max(255).optional(),
      }),

      // Audio specific
      ptt: Joi.when("mediaType", {
        is: "audio",
        then: Joi.boolean().optional().default(false),
      }),

      // Common options
      quality: Joi.number().min(0).max(100).optional(),
      duration: Joi.number().positive().optional(),
    })
      .optional()
      .default({}),

    // Additional metadata
    metadata: Joi.object({
      author: Joi.string().optional(),
      title: Joi.string().optional(),
      description: Joi.string().optional(),
    }).optional(),
  }),
};
