import * as intakes from '../services/intakes.service.js';
import { intakeSchema, dateQuerySchema } from '../services/schemas.js';

export const create = async (req, res) => res.status(201).json(await intakes.addIntake(req.params.userId, intakeSchema.parse(req.body)));

export const list = async (req, res) => res.json(await intakes.listIntakes(req.params.userId, dateQuerySchema.parse(req.query).date));

export const remove = async (req, res) => {
  await intakes.deleteIntake(req.params.userId, req.params.intakeId);
  res.status(204).end();
};
