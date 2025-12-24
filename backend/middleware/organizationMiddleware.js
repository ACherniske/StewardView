const { getOrganization, isValidOrganization } = require('../config/organizations');

/**
 * Middleware to validate organization from route params
 * @returns {Function} Express middleware function
 */

const validateOrganization = (req, res, next) => {
    const orgSlug = req.params.orgName || req.body.orgName;

    if (!orgSlug) {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: 'Missing organization name'
        });
    }

    //normalize to lowercase
    const normalizedSlug = orgSlug.toLowerCase();

    if (!isValidOrganization(normalizedSlug)) {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: `Invalid or inactive organization: '${orgSlug}'`,
            suggestion: 'Please check the organization name and try again.'
        });
    }

    try {
        const org = getOrganization(normalizedSlug);

        //attach organization
        req.organization = {
            slug: normalizedSlug,
            name: org.name,
        };

        console.log(`Request for organization: ${normalizedSlug}`);
        next();

    } catch (error) {
        return res.status(403).json({
            status: 403,
            error: 'Forbidden',
            message: 'Access to the organization is forbidden'
        });
    }
};

/**
 * Validate trail name middleware
 * @returns {Function} Express middleware function
 */

const validateTrailName = (req, res, next) => {
    const trailName = req.params.trailName || req.body.trailName;

    if (!trailName || typeof trailName !== 'string' || trailName.trim() === '') {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: 'Invalid or missing trailName'
        });
    }

    //sanitize trail name
    const sanitized = trailName.trim().replace(/[^a-zA-Z0-9-_ ]/g, '');

    if (sanitized.length === 0) {
        return res.status(400).json({
            status: 400,
            error: 'Validation failed',
            message: 'trailName cannot be empty after sanitization'
        });
    }

    req.trailName = sanitized;
    next();

};

/**
 * Log organization access
 * @returns {Function} Express middleware function
 */

const logOrganizationAccess = (req, res, next) => {
    if (req.organization) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Accessing organization: ${req.organization.slug}`);
    }
    next();
};

module.exports = {
    validateOrganization,
    validateTrailName,
    logOrganizationAccess
};