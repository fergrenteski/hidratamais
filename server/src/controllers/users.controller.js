import * as users from '../services/users.service.js';
import { createUserSchema, updateUserSchema, goalsSchema, searchQuerySchema } from '../services/schemas.js';

export const create = async (req, res) => res.status(201).json(await users.createUser(createUserSchema.parse(req.body)));

export const search = async (req, res) => res.json(await users.searchUsers(searchQuerySchema.parse(req.query).name));

export const get = async (req, res) => res.json(await users.getUser(req.params.userId));

export const update = async (req, res) => res.json(await users.updateUser(req.params.userId, updateUserSchema.parse(req.body)));

export const updateGoals = async (req, res) => res.json(await users.updateGoals(req.params.userId, goalsSchema.parse(req.body)));

export const remove = async (req, res) => {
  await users.deleteUser(req.params.userId);
  res.status(204).end();
};
