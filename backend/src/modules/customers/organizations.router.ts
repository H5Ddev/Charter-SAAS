import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { tenantScope } from '../../shared/middleware/tenantScope';
import { OrganizationsController } from './organizations.controller';

const router = Router();
const controller = new OrganizationsController();

router.use(requireAuth);
router.use(tenantScope);

router.get('/', controller.list.bind(controller));
router.get('/:id', controller.findById.bind(controller));
router.post('/', controller.create.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.softDelete.bind(controller));

export { router as organizationsRouter };
