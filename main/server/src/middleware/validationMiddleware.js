const Joi = require('joi');

const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error } = schema.validate(req[source]);
        if (error) {
            return res.status(400).json({
                error: 'Validation Error',
                details: error.details.map(detail => detail.message)
            });
        }
        next();
    };
};

const schemas = {
    login: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        password: Joi.string().required()
    }),
    searchByMobile: Joi.object({
        mobile: Joi.string().pattern(/^[0-9]{10}$/).required()
    }),
    patientValidation: Joi.object({

        patientName: Joi.string().min(3).required(),
        roomNumber: Joi.string().required(),
        bedNumber: Joi.string().required(),
        relativeMobile: Joi.string().pattern(/^[0-9]{10}$/).required()
    }),
    sendOtp: Joi.object({
        mobile: Joi.string().pattern(/^[0-9]{10}$/).required(),
        admission_id: Joi.string().uuid().required()
    }),
    verifyOtp: Joi.object({
        sessionId: Joi.string().uuid().required(),
        otp: Joi.string().pattern(/^[0-9]{4,6}$/).required(),
        mobile: Joi.string().pattern(/^[0-9]{10}$/).optional()
    })
};

module.exports = {
    validate,
    schemas
};
