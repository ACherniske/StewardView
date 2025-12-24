/**
 * Organizations registery 
 * Each organization has its own google Drive folder for storing images
 * 
 * Structure:
 * {
 *   "orgSlug": {
 *      name: "Organization Name",
 *      driveFolderId: "Google Drive Folder ID"
 *      active: true/false
 *    }
 * }
 */

const organizations = {
    //example organization
    "test-organization": {
        name: "Test Organization",
        driveFolderId: "1fBOxspMIqUWu-TqMsvCzzSp0BehZq09d",
        active: true
    },

    "kent-land-trust": {
        name: "Kent Land Trust",
        driveFolderId: "1oybMDc9Ei3zkmvlwj767_ANcY95z8Zwb",
        active: true
    },

    //add more organizations as needed
};

/**
 * Get organization config by slug
 * @returns org object or null if not found
 * @throws error if org is inactive
 */

function getOrganization(orgSlug) {
    const org = organizations[orgSlug.toLowerCase()];

    if (!org) {
        return null;
    }

    if (!org.active) {
        throw new Error(`Organization '${orgSlug}' is not active.`);
    }

    return {
        slug: orgSlug,
        ...org,
    };
}

/**
 * check if org is valid and active
 * @return boolean
 */

function isValidOrganization(orgSlug) {
    const org = organizations[orgSlug.toLowerCase()];
    return org && org.active === true;
}

/**
 * List all active organizations
 * @return array of org objects
 */

function listActiveOrganizations() {
    return Object.entries(organizations)
        .filter(([_, org]) => org.active)
        .map(([slug, org]) => ({
            slug,
            name: org.name,
        }));
}

module.exports = {
    getOrganization,
    isValidOrganization,
    listActiveOrganizations,
};