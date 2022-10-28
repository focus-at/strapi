import { resolve } from 'path';
import { ALLOWED_CONTENT_TYPES } from '../constants';

const {
  file: {
    providers: { createLocalFileSourceProvider },
  },
  strapi: {
    providers: { createRemoteStrapiDestinationProvider },
  },
  engine: { createTransferEngine },
} = require('@strapi/data-transfer');

/**
 * Reset the DB and import data from a DTS backup
 * This function ensures we keep all admin user's and roles in the DB
 * see: https://docs.strapi.io/developer-docs/latest/developer-resources/data-management.html
 * @param {String} filePath the path to a DTS backup
 */
export const resetDatabaseAndImportDataFromPath = async (filePath) => {
  const source = createSourceProvider(filePath);
  const destination = createDestinationProvider();

  const engine = createTransferEngine(source, destination, {
    versionStrategy: 'ignore',
    schemaStrategy: 'ignore',
    only: ['content'],
    transforms: {
      links: [
        {
          filter(link) {
            return (
              ALLOWED_CONTENT_TYPES.includes(link.left.type) &&
              (ALLOWED_CONTENT_TYPES.includes(link.right.type) || link.right.type === undefined)
            );
          },
        },
      ],
      entities: [
        {
          filter(entity) {
            return ALLOWED_CONTENT_TYPES.includes(entity.type);
          },
        },
      ],
    },
  });

  engine.diagnostics.onDiagnostic(console.log);

  try {
    await engine.transfer();
  } catch {
    console.error('Import process failed.');
    process.exit(1);
  }
};

const createSourceProvider = (filePath) =>
  createLocalFileSourceProvider({
    file: { path: resolve(filePath) },
    encryption: { enabled: false },
    compression: { enabled: false },
  });

const createDestinationProvider = () =>
  createRemoteStrapiDestinationProvider({
    url: new URL('http://localhost:1337/admin'),
    strategy: 'restore',
    restore: {
      entities: {
        include: ALLOWED_CONTENT_TYPES,
      },
      configuration: {
        coreStore: false,
        webhook: false,
      },
    },
  });
