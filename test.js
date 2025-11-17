'use strict';

/**
 * post controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::post.post', ({ strapi }) => ({
  // Custom secure create using the private field on PlatformUser
  async secureCreate(ctx) {
    const payload = ctx.request.body?.data || ctx.request.body || {};
    const { browserDataCombinationID, post } = payload;

    if (!browserDataCombinationID || !post) {
      return ctx.badRequest('browserDataCombinationID and post are required.');
    }

    // --- 1. Find PlatformUser using the best match system ---
    // This single line replaces the old exact-match query
    const platformUser = await strapi
      .service('api::platform-user.platform-user')
      .findUserByBestMatch(browserDataCombinationID);

    // --- 2. Check if a user was found (perfect or weighted) ---
    if (!platformUser) {
      // No user matched the ID, even with weighted scoring
      return ctx.unauthorized('Invalid or unmatched BrowserDataCombinationID.');
    }

    // --- 3. Create Post linked to the found PlatformUser ---
    const created = await strapi.entityService.create('api::post.post', {
      data: { ...post, platform_user: platformUser.id },
    });

    ctx.body = created;
  },
}));
