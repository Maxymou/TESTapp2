export const pagePaths = {
  home: '/',
  module1: '/module-1',
  module2: '/module-2',
  settings: '/settings',
  about: '/about',
  users: '/settings/users',
  dev: '/settings/dev',
  login: '/login'
};

export const routeFromPath = (pathname) => {
  const match = Object.entries(pagePaths).find(([, path]) => path === pathname);
  return match?.[0] || (pathname === '/login' ? 'login' : 'home');
};
