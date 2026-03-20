import express from 'express';
import { AgendaController } from '../controllers/agenda.controller';
import { authenticate, requirePermission } from '../middleware/auth';

const router = express.Router();

export const createAgendaRoutes = (agendaController: AgendaController) => {
    router.get('/renewal-calendar', authenticate as any, requirePermission('renewalCalendar', 'read') as any, agendaController.getRenewalCalendar);

    return router;
};
