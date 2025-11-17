'useD strict';

/**
 * post controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::post.post', ({ strapi }) => ({
  // Custom secure create
  async secureCreate(ctx) {
    const payload = ctx.request.body?.data || ctx.request.body || {};
    const { browserDataCombinationID, post } = payload;

    if (!browserDataCombinationID || !post) {
      return ctx.badRequest('browserDataCombinationID and post are required.');
    }

    let platformUser = null;
    try {
      // --- 1. Verify the service and function exist before calling ---
      const platformUserService = strapi.service('api::platform-user.platform-user');
      
      if (!platformUserService) {
        console.error('FATAL: Platform-user service is NOT loaded.');
        return ctx.internalServerError('Platform-user service not available.');
      }
      
      if (typeof platformUserService.findUserByBestMatch !== 'function') {
        console.error('FATAL: findUserByBestMatch function does NOT exist on the service.');
        console.log('Service object keys:', Object.keys(platformUserService));
        return ctx.internalServerError('Platform-user service is not configured correctly.');
      }

      console.log('Service loaded. Attempting to find user by best match...');
      platformUser = await platformUserService.findUserByBestMatch(browserDataCombinationID);

    } catch (error) {
      // --- This will catch the error if the service call itself fails ---
      console.error('--- ERROR IN POST CONTROLLER ---');
      console.error('Failed to execute findUserByBestMatch:', error.message);
      console.error('Stack:', error.stack);
      console.error('Full Error Object:', error);
      return ctx.internalServerError('An error occurred while finding the user.', { error: error.message });
    }

    // --- 2. Check if a user was found (perfect or weighted) ---
    if (!platformUser) {
      console.log('No user matched the ID, even with weighted scoring.');
      return ctx.unauthorized('Invalid or unmatched BrowserDataCombinationID.');
    }

    // --- 3. Create Post linked to the found PlatformUser ---
    console.log(`User ${platformUser.Username} found. Creating post...`);
    const created = await strapi.entityService.create('api::post.post', {
      data: { ...post, platform_user: platformUser.id },
    });

    ctx.body = created;
  },
}));
