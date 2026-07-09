import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { STAFF_COURSE_ROLES } from '../common/constants/staff-roles.constants';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ApiOkData } from '../common/swagger';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin/dashboard')
@ApiBearerAuth()
@RequireRole(...STAFF_COURSE_ROLES)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('overview')
  @ApiOkData(Object)
  @ResponseMessage('Dashboard overview retrieved successfully')
  getOverview(): ReturnType<AdminDashboardService['getOverview']> {
    return this.adminDashboardService.getOverview();
  }
}
