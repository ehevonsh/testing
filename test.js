module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/secure/platform-users/update',
      handler: 'platform-user.updateWithSecret',
      config: { auth: false },
    },
  ],
};
