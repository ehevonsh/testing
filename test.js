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

    // Find PlatformUser by private field (server-side filtering is allowed)
    const platformUser = await strapi.db
      .query('api::platform-user.platform-user')
      .findOne({ where: { BrowserDataCombinationID: browserDataCombinationID } });

    if (!platformUser) return ctx.unauthorized('Invalid BrowserDataCombinationID.');

    // Create Post linked to that PlatformUser
    const created = await strapi.entityService.create('api::post.post', {
      data: { ...post, platform_user: platformUser.id },
    });

    ctx.body = created;
  },
}));
