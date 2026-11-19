import { body, validationResult } from 'express-validator';

/**
 * Middleware to check express-validator errors and return 400 Bad Request
 */
export const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: errors.array()[0].msg,
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

/**
 * Validation rules for student registration
 */
export const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('A valid college email address is required.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters.'),
  body('department')
    .trim()
    .notEmpty()
    .withMessage('Academic department is required.'),
  body('yearOfStudy')
    .notEmpty()
    .withMessage('Year of study is required.')
    .isInt({ min: 1, max: 8 })
    .withMessage('Year of study must be an integer between 1 and 8.'),
  body('bio')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters.'),
  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array of topic strings.'),
  checkValidation
];

/**
 * Validation rules for student login
 */
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('A valid college email address is required.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
  checkValidation
];

/**
 * Validation rules for profile update
 */
export const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Full name cannot be empty.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters.'),
  body('department')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Department cannot be empty.'),
  body('yearOfStudy')
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage('Year of study must be an integer between 1 and 8.'),
  body('bio')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters.'),
  body('profileImageUrl')
    .optional()
    .isString(),
  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array of strings.'),
  checkValidation
];

