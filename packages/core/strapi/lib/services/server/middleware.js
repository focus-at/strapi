'use strict';

const path = require('path');
const { propOr, isArray, isFunction } = require('lodash/fp');

const getMiddlewareConfig = propOr([], 'config.middlewares');

const resolveRouteMiddlewares = (route, strapi) => {
  const middlewaresConfig = getMiddlewareConfig(route);

  if (!isArray(middlewaresConfig)) {
    throw new Error('Route middlewares config must be an array');
  }

  const middlewares = resolveMiddlewares(middlewaresConfig, strapi);

  return middlewares
    .filter(middleware => isFunction(middleware.handler))
    .map(({ handler }) => handler);
};

/**
 * Initialize every configured middlewares
 * @param {MiddlewaresConfig} config
 * @param {Strapi} strapi
 * @returns {Middlewares}
 */
const resolveMiddlewares = (config, strapi) => {
  const middlewares = [];

  for (const item of config) {
    if (typeof item === 'function') {
      middlewares.push({
        name: null,
        handler: item,
      });

      continue;
    }

    if (typeof item === 'string') {
      const middlewareFactory = strapi.middleware(item);

      if (!middlewareFactory) {
        throw new Error(`Middleware ${item} not found.`);
      }

      middlewares.push({
        name: item,
        handler: middlewareFactory({}, { strapi }),
      });

      continue;
    }

    if (typeof item === 'object' && item !== null) {
      const { name, resolve, config = {} } = item;

      if (name) {
        const middlewareFactory = strapi.middleware(name);
        middlewares.push({
          name,
          handler: middlewareFactory(config, { strapi }),
        });

        continue;
      }

      if (resolve) {
        middlewares.push({
          name: resolve,
          handler: resolveCustomMiddleware(resolve, strapi)(config, { strapi }),
        });

        continue;
      }

      throw new Error('Invalid middleware configuration. Missing name or resolve properties.');
    }

    throw new Error(
      'Middleware config must either be a string or an object {name?: string, resolve?: string, config: any}.'
    );
  }

  return middlewares;
};

/**
 * Resolve middleware from package name or path
 * @param {string} resolve
 * @param {Strapi} strapi
 */
const resolveCustomMiddleware = (resolve, strapi) => {
  let modulePath;

  try {
    modulePath = require.resolve(resolve);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      modulePath = path.resolve(strapi.dirs.root, resolve);
    } else {
      throw error;
    }
  }

  try {
    return require(modulePath);
  } catch (err) {
    throw new Error(`Could not load middleware "${modulePath}".`);
  }
};

module.exports = {
  resolveRouteMiddlewares,
  resolveMiddlewares,
};
