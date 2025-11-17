import express from 'express';
import { AgendaController } from '../controllers/agenda.controller';
import { authenticate } from '../middleware/auth';

const router = express.Router();

export const createAgendaRoutes = (agendaController: AgendaController) => {
    router.get('/renewal-calendar', authenticate, agendaController.getRenewalCalendar);

    return router;
};
