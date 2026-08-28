import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock data ────────────────────────────────────────────────────────────────

const makeProfile = (overrides = {}) => ({
  id: 'profile-1',
  userId: 'user-1',
  accountStatus: 'ACTIVE',
  onboardingStatus: 'NOT_STARTED',
  onboardingStep: 0,
  profileVersion: 1,
  displayName: null,
  dateOfBirth: null,
  gender: null,
  heightCm: null,
  weightKg: null,
  goalIds: [],
  preferredTastes: [],
  dietTypeIds: [],
  allergenIds: [],
  ...overrides,
});

const mockPrismaDb = {
  profile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  onboardingSession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrismaService = { db: mockPrismaDb };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── getState ───────────────────────────────────────────────────────────────

  describe('getState', () => {
    it('should throw NotFoundException when profile not found', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce(null);
      await expect(service.getState('user-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when account is not ACTIVE', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce(
        makeProfile({ accountStatus: 'PENDING' }),
      );
      await expect(service.getState('user-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should return onboarding state for active profile', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce(makeProfile());
      mockPrismaDb.onboardingSession.findFirst.mockResolvedValueOnce(null);

      const state = await service.getState('user-1');
      expect(state.onboardingStatus).toBe('NOT_STARTED');
      expect(state.profileVersion).toBe(1);
    });
  });

  // ── start ──────────────────────────────────────────────────────────────────

  describe('start', () => {
    it('should throw NotFoundException when profile not found', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce(null);
      await expect(service.start('user-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should update profile status to IN_PROGRESS for NOT_STARTED profile', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce(makeProfile());
      mockPrismaDb.onboardingSession.findFirst.mockResolvedValueOnce(null);
      mockPrismaDb.onboardingSession.upsert.mockResolvedValueOnce({ id: 'session-1', draft: {}, lastSavedStep: 0 });
      mockPrismaDb.profile.update.mockResolvedValueOnce(
        makeProfile({ onboardingStatus: 'IN_PROGRESS' }),
      );

      const result = await service.start('user-1');
      expect(result.onboardingStatus).toBe('IN_PROGRESS');
      expect(mockPrismaDb.profile.update).toHaveBeenCalledTimes(1);
    });

    it('should NOT update profile when already IN_PROGRESS', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce(
        makeProfile({ onboardingStatus: 'IN_PROGRESS' }),
      );
      mockPrismaDb.onboardingSession.findFirst.mockResolvedValueOnce(null);
      mockPrismaDb.onboardingSession.upsert.mockResolvedValueOnce({
        id: 'session-1',
        draft: {},
        lastSavedStep: 0,
      });

      const result = await service.start('user-1');
      expect(result.onboardingStatus).toBe('IN_PROGRESS');
      // Không gọi update vì đã IN_PROGRESS
      expect(mockPrismaDb.profile.update).not.toHaveBeenCalled();
    });

    it('should return COMPLETED status without updating for COMPLETED profile', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce(
        makeProfile({ onboardingStatus: 'COMPLETED' }),
      );
      mockPrismaDb.onboardingSession.findFirst.mockResolvedValueOnce(null);

      const result = await service.start('user-1');
      expect(result.onboardingStatus).toBe('COMPLETED');
      expect(mockPrismaDb.profile.update).not.toHaveBeenCalled();
    });
  });
});
