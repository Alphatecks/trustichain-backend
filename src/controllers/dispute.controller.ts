import { Request, Response } from 'express';
import {
  GetDisputeSummaryResponse,
  GetDisputesResponse,
  GetDisputeDetailResponse,
  DisputeStatus,
  CreateDisputeRequest,
  CreateDisputeResponse,
  UploadEvidenceResponse,
  AddEvidenceRequest,
  AddEvidenceResponse,
  GetEvidenceResponse,
  UpdateEvidenceRequest,
  UpdateEvidenceResponse,
  DeleteEvidenceResponse,
  TrackDisputeActivityResponse,
  GetDisputeActivityResponse,
  CreateAssessmentRequest,
  CreateAssessmentResponse,
  UpdateAssessmentRequest,
  UpdateAssessmentResponse,
  GetAssessmentResponse,
  GetAssessmentsResponse,
  DeleteAssessmentResponse,
  CreateTimelineEventRequest,
  CreateTimelineEventResponse,
  GetTimelineEventsResponse,
  DeleteTimelineEventResponse,
  GetFinalVerdictResponse,
  AssignMediatorRequest,
  AssignMediatorResponse,
  SubmitFinalVerdictRequest,
  SubmitFinalVerdictResponse,
  UpdateVerdictStatusRequest,
  UpdateVerdictStatusResponse,
} from '../types/api/dispute.types';
import { disputeService } from '../services/dispute/dispute.service';
import { storageService } from '../services/storage/storage.service';

export class DisputeController {
  /**
   * Get dispute summary metrics for dashboard
   * GET /api/disputes/summary
   */
  async getSummary(req: Request, res: Response<GetDisputeSummaryResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const month = (req.query.month as string | undefined) || undefined; // "YYYY-MM"

      const result = await disputeService.getSummary(userId, month);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get list of disputes for table
   * GET /api/disputes
   */
  async getDisputes(req: Request, res: Response<GetDisputesResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const statusParam = (req.query.status as string | undefined) || 'all';
      const month = (req.query.month as string | undefined) || undefined; // "YYYY-MM"
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;

      const status =
        statusParam === 'all'
          ? 'all'
          : (statusParam as DisputeStatus | 'all');

      const result = await disputeService.getDisputes({
        userId,
        status,
        month,
        page,
        pageSize,
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get dispute detail by ID
   * GET /api/disputes/:id
   */
  async getDisputeById(
    req: Request,
    res: Response<GetDisputeDetailResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.id;

      const result = await disputeService.getDisputeById(userId, disputeId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' ? 404 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Create a new dispute
   * POST /api/disputes
   */
  async createDispute(
    req: Request,
    res: Response<CreateDisputeResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const request = req.body as CreateDisputeRequest;

      const result = await disputeService.createDispute(userId, request);

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Upload evidence file for dispute
   * POST /api/disputes/evidence/upload
   */
  async uploadEvidence(
    req: Request,
    res: Response<UploadEvidenceResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'No file provided',
          error: 'No file provided',
        });
        return;
      }

      const result = await storageService.uploadFile(userId, file);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Add evidence to a dispute
   * POST /api/disputes/:disputeId/evidence
   */
  async addEvidence(
    req: Request,
    res: Response<AddEvidenceResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const request = req.body as AddEvidenceRequest;

      const result = await disputeService.addEvidence(userId, disputeId, request);

      if (result.success) {
        res.status(201).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all evidence for a dispute
   * GET /api/disputes/:disputeId/evidence
   */
  async getEvidence(
    req: Request,
    res: Response<GetEvidenceResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;

      const result = await disputeService.getEvidence(userId, disputeId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Update evidence metadata
   * PUT /api/disputes/:disputeId/evidence/:evidenceId
   */
  async updateEvidence(
    req: Request,
    res: Response<UpdateEvidenceResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const evidenceId = req.params.evidenceId;
      const request = req.body as UpdateEvidenceRequest;

      const result = await disputeService.updateEvidence(userId, disputeId, evidenceId, request);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' || result.error === 'Evidence not found' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Delete evidence
   * DELETE /api/disputes/:disputeId/evidence/:evidenceId
   */
  async deleteEvidence(
    req: Request,
    res: Response<DeleteEvidenceResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const evidenceId = req.params.evidenceId;

      const result = await disputeService.deleteEvidence(userId, disputeId, evidenceId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' || result.error === 'Evidence not found' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Upload file and add evidence in one call
   * POST /api/disputes/:disputeId/evidence/upload-and-add
   */
  async uploadAndAddEvidence(
    req: Request,
    res: Response<AddEvidenceResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const file = (req as any).file;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'No file provided',
          error: 'No file provided',
        });
        return;
      }

      // Get metadata from form data
      const title = req.body.title || '';
      const description = req.body.description || '';
      const evidenceType = req.body.evidenceType;

      if (!title || !description || !evidenceType) {
        res.status(400).json({
          success: false,
          message: 'Title, description, and evidence type are required',
          error: 'Missing required fields',
        });
        return;
      }

      // Step 1: Upload file
      const uploadResult = await storageService.uploadFile(userId, file);

      if (!uploadResult.success || !uploadResult.data) {
        res.status(400).json({
          success: false,
          message: uploadResult.message || 'Failed to upload file',
          error: uploadResult.error || 'File upload failed',
        });
        return;
      }

      // Step 2: Create evidence record
      const addEvidenceRequest: AddEvidenceRequest = {
        title,
        description,
        evidenceType: evidenceType as any,
        fileUrl: uploadResult.data.fileUrl,
        fileName: uploadResult.data.fileName,
        fileType: uploadResult.data.fileType,
        fileSize: uploadResult.data.fileSize,
      };

      const result = await disputeService.addEvidence(userId, disputeId, addEvidenceRequest);

      if (result.success) {
        res.status(201).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Track user activity on dispute page
   * POST /api/disputes/:disputeId/activity
   */
  async trackActivity(
    req: Request,
    res: Response<TrackDisputeActivityResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;

      const result = await disputeService.trackActivity(userId, disputeId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get activity status for a dispute
   * GET /api/disputes/:disputeId/activity
   */
  async getActivity(
    req: Request,
    res: Response<GetDisputeActivityResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;

      const result = await disputeService.getActivity(userId, disputeId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Create a new assessment for a dispute
   * POST /api/disputes/:disputeId/assessments
   */
  async createAssessment(
    req: Request,
    res: Response<CreateAssessmentResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const request = req.body as CreateAssessmentRequest;

      const result = await disputeService.createAssessment(userId, disputeId, request);

      if (result.success) {
        res.status(201).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get all assessments for a dispute
   * GET /api/disputes/:disputeId/assessments
   */
  async getAssessments(
    req: Request,
    res: Response<GetAssessmentsResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;

      const result = await disputeService.getAssessments(userId, disputeId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get assessment by ID
   * GET /api/disputes/:disputeId/assessments/:assessmentId
   */
  async getAssessmentById(
    req: Request,
    res: Response<GetAssessmentResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const assessmentId = req.params.assessmentId;

      const result = await disputeService.getAssessmentById(userId, disputeId, assessmentId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' || result.error === 'Assessment not found' ? 404 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Update an assessment
   * PUT /api/disputes/:disputeId/assessments/:assessmentId
   */
  async updateAssessment(
    req: Request,
    res: Response<UpdateAssessmentResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const assessmentId = req.params.assessmentId;
      const request = req.body as UpdateAssessmentRequest;

      const result = await disputeService.updateAssessment(userId, disputeId, assessmentId, request);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' || result.error === 'Assessment not found' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Delete an assessment
   * DELETE /api/disputes/:disputeId/assessments/:assessmentId
   */
  async deleteAssessment(
    req: Request,
    res: Response<DeleteAssessmentResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const assessmentId = req.params.assessmentId;

      const result = await disputeService.deleteAssessment(userId, disputeId, assessmentId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' || result.error === 'Assessment not found' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Create a timeline event (manual entry)
   * POST /api/disputes/:disputeId/timeline
   */
  async createTimelineEvent(
    req: Request,
    res: Response<CreateTimelineEventResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const request = req.body as CreateTimelineEventRequest;

      const result = await disputeService.createTimelineEvent(userId, disputeId, request);

      if (result.success) {
        res.status(201).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get timeline events for a dispute
   * GET /api/disputes/:disputeId/timeline
   */
  async getTimelineEvents(
    req: Request,
    res: Response<GetTimelineEventsResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;

      const result = await disputeService.getTimelineEvents(userId, disputeId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Delete a timeline event (manual events only)
   * DELETE /api/disputes/:disputeId/timeline/:eventId
   */
  async deleteTimelineEvent(
    req: Request,
    res: Response<DeleteTimelineEventResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const eventId = req.params.eventId;

      const result = await disputeService.deleteTimelineEvent(userId, disputeId, eventId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' || result.error === 'Timeline event not found' || result.error === 'Cannot delete system event' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get final verdict status for a dispute
   * GET /api/disputes/:disputeId/verdict
   */
  async getFinalVerdict(
    req: Request,
    res: Response<GetFinalVerdictResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;

      const result = await disputeService.getFinalVerdict(userId, disputeId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Assign mediator to dispute
   * POST /api/disputes/:disputeId/verdict/assign-mediator
   */
  async assignMediator(
    req: Request,
    res: Response<AssignMediatorResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const request = req.body as AssignMediatorRequest;

      const result = await disputeService.assignMediator(userId, disputeId, request);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Update verdict status
   * PUT /api/disputes/:disputeId/verdict/status
   */
  async updateVerdictStatus(
    req: Request,
    res: Response<UpdateVerdictStatusResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const request = req.body as UpdateVerdictStatusRequest;

      const result = await disputeService.updateVerdictStatus(userId, disputeId, request);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Submit final verdict/decision
   * POST /api/disputes/:disputeId/verdict/submit
   */
  async submitFinalVerdict(
    req: Request,
    res: Response<SubmitFinalVerdictResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const disputeId = req.params.disputeId;
      const request = req.body as SubmitFinalVerdictRequest;

      const result = await disputeService.submitFinalVerdict(userId, disputeId, request);

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Dispute not found or access denied' || result.error === 'Access denied' ? 403 : 400;
        res.status(statusCode).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }
}

export const disputeController = new DisputeController();


