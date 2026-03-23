import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { CrewService, CreateCrewMemberSchema, UpdateCrewMemberSchema, AddCrewDocumentSchema, AssignTripCrewSchema } from './crew.service'
import { successResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

const prisma = new PrismaClient()
const service = new CrewService(prisma)

export const crewRouter: Router = Router()
crewRouter.use(requireAuth)
crewRouter.use(tenantScope)

crewRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query['page']) || 1
    const pageSize = Number(req.query['pageSize']) || 50
    const role = req.query['role'] as string | undefined
    const isActive = req.query['isActive'] !== undefined ? req.query['isActive'] === 'true' : undefined
    const result = await service.list(req.tenantId!, page, pageSize, role, isActive)
    res.json(successResponse(result.crew, result.meta as Record<string, unknown>))
  } catch (err) { next(err) }
})

crewRouter.get('/expiring', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Number(req.query['days']) || 90
    const result = await service.getExpiringDocuments(req.tenantId!, days)
    res.json(successResponse(result))
  } catch (err) { next(err) }
})

crewRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await service.findById(req.tenantId!, req.params.id!)
    res.json(successResponse(member))
  } catch (err) { next(err) }
})

crewRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateCrewMemberSchema.parse(req.body)
    const member = await service.create(req.tenantId!, data)
    res.status(201).json(successResponse(member))
  } catch (err) { next(err) }
})

crewRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = UpdateCrewMemberSchema.parse(req.body)
    const member = await service.update(req.tenantId!, req.params.id!, data)
    res.json(successResponse(member))
  } catch (err) { next(err) }
})

crewRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.softDelete(req.tenantId!, req.params.id!)
    res.json(successResponse({ deleted: true }))
  } catch (err) { next(err) }
})

crewRouter.post('/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = AddCrewDocumentSchema.parse(req.body)
    const doc = await service.addDocument(req.tenantId!, req.params.id!, data)
    res.status(201).json(successResponse(doc))
  } catch (err) { next(err) }
})

crewRouter.delete('/:id/documents/:docId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteDocument(req.tenantId!, req.params.docId!)
    res.json(successResponse({ deleted: true }))
  } catch (err) { next(err) }
})

crewRouter.post('/trips/:tripId/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = AssignTripCrewSchema.parse(req.body)
    const assignment = await service.assignToTrip(req.tenantId!, req.params.tripId!, data)
    res.status(201).json(successResponse(assignment))
  } catch (err) { next(err) }
})

crewRouter.delete('/trips/:tripId/assign/:crewMemberId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.removeFromTrip(req.tenantId!, req.params.tripId!, req.params.crewMemberId!)
    res.json(successResponse({ deleted: true }))
  } catch (err) { next(err) }
})
