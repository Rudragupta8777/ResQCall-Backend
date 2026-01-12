const Joi = require('joi');

const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
        console.warn(`Unauthorized access attempt from IP: ${req.ip}`);
        return res.status(403).json({ error: "Access Denied: Invalid or missing API Key" });
    }
    next();
};

const schemas = {
    fall: Joi.object({
        deviceId: Joi.string().required(),
        lat: Joi.number().min(-90).max(90).required(),
        lon: Joi.number().min(-180).max(180).required(),
        battery: Joi.number().min(0).max(100).required()
    }),
    pair: Joi.object({
        deviceId: Joi.string().required(),
        secretPin: Joi.string().length(6).required(), 
        firebaseUid: Joi.string().required()
    }),
    ping: Joi.object({
        deviceId: Joi.string().required(),
        battery: Joi.number().min(0).max(100).required()
    })
};

const validateBody = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    next();
};

module.exports = { validateApiKey, validateBody, schemas };