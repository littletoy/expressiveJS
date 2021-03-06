/*
  expressive.js wraps express, inserting middleware to track how the server
  response and client request objects change as they travel through the developer's
  middleware.

*/

const express = require('express');
const getAppMethodArgs = require('./util/getAppMethodArgs.js');
const jsonController = require('./util/jsonController.js');
const serverListeners = require('./util/serverListeners.js');

const requestMethods = ['all', 'checkout', 'copy', 'delete', 'get', 'head', 'lock', 'merge',
  'mkactivity', 'mkcol', 'move', 'm-search', 'notify', 'options', 'patch', 'post',
  'purge', 'put', 'report', 'search', 'subscribe', 'trace', 'unlock', 'unsubscribe'];


const originalRouter = express.Router;
express.Router = (...routerArgs) => {
  const router = originalRouter.call(express, ...routerArgs);

  requestMethods.forEach(method => {
    const originalMethod = router[method];
    router[method] = (...methodArgs) => originalMethod.bind(router)(...getAppMethodArgs(methodArgs));
  })

  const originalUse = router.use;
  router.use = (...useArgs) => originalUse.bind(router)(...getAppMethodArgs(useArgs));

  const originalParam = router.param;
  router.param = (...paramArgs) => originalParam.bind(router)(...getAppMethodArgs(paramArgs));

  const originalRoute = router.route;
  router.route = (path) => {
    const route = originalRoute.bind(router)(path);

    requestMethods.forEach(method => {
      const originalMethod = route[method];
      route[method] = (...methodArgs) => originalMethod.bind(route)(...getAppMethodArgs(methodArgs));
    })

    const originalUse = route.use;
    route.use = (...useArgs) => originalUse.bind(route)(...getAppMethodArgs(useArgs));

    return route;
  }

  return router;
}


const expressive = () => {
  const app = express(); //.call(expressive);

  const originalListen = app.listen;
  app.listen = (...listenArgs) => {
    const server = originalListen.bind(app)(...listenArgs);
    //set up server listeners!
    Object.keys(serverListeners).forEach(event => {
      server.on(event, serverListeners[event]);
    });
    //sends message to parent process that it may start firing requests!
    if (process.send) process.send('listening');
    return server;
  };

  const originalUse = app.use;
  app.use = (...useArgs) => originalUse.bind(app)(...getAppMethodArgs(useArgs));

  const originalRoute = app.route;
  app.route = (path) => {
    const route = originalRoute.bind(app)(path);

    requestMethods.forEach(method => {
      const originalMethod = route[method];
      route[method] = (...methodArgs) => originalMethod.bind(route)(...getAppMethodArgs(methodArgs));
    });

    const originalUse = route.use;
    route.use = (...useArgs) => originalUse.bind(route)(...getAppMethodArgs(useArgs));

    return route;
  }

  const originalParam = app.param;
  app.param = (...args) => originalParam.bind(app)(...getAppMethodArgs(args))

  requestMethods.forEach(method => {
    const originalMethod = app[method];
    app[method] = (...args) => originalMethod.bind(app)(...getAppMethodArgs(args));
  });

  // These do not alter the request and response so there is no need to track them
  // app.disable: () => {};
  // app.disabled: () => {};
  // app.enable: () => {};
  // app.enabled: () => {};
  // app.engine: () => {};
  // app.path: () => {};
  // app.render: () => {};
  // app.set: () => {};

  return app;
}


//Assign prototype and all properties and methods from express to expressive
Object.keys(express).forEach(key => {
  if (typeof express[key] === 'function') {
    const originalMethod = express[key];
    expressive[key] = (...methodArgs) => originalMethod.bind(expressive)(...methodArgs);
  } else expressive[key] = express[key];
});

Object.setPrototypeOf(expressive, express);


module.exports = expressive;