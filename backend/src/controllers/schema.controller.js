import * as schemaService from '../services/schema.service.js';

export const runSchemaInit = async (req, res, next) => {
  try {
    const results = await schemaService.initializeSchema();
    return res.status(200).json({
      message: 'Neo4j database schema constraints and indexes processed successfully.',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

export const getSchemaOverview = async (req, res, next) => {
  try {
    const status = await schemaService.getSchemaStatus();
    return res.status(200).json({
      message: 'Current Neo4j schema and entity statistics retrieved.',
      data: status
    });
  } catch (error) {
    next(error);
  }
};

