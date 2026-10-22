import { Router } from 'express';
import * as users from '../controllers/users.controller.js';
import * as intakes from '../controllers/intakes.controller.js';
import * as stats from '../controllers/stats.controller.js';

export const router = Router();

router.get('/health', stats.health);

router.post('/users', users.create);
router.get('/users/search', users.search);
router.get('/users/:userId', users.get);
router.patch('/users/:userId', users.update);
router.put('/users/:userId/goals', users.updateGoals);
router.delete('/users/:userId', users.remove);

router.post('/users/:userId/intakes', intakes.create);
router.get('/users/:userId/intakes', intakes.list);
router.delete('/users/:userId/intakes/:intakeId', intakes.remove);

router.get('/users/:userId/stats/today', stats.today);
router.get('/users/:userId/stats/history', stats.history);
router.get('/users/:userId/stats/summary', stats.summary);
