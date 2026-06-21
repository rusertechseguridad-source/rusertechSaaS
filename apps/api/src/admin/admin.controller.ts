import { Controller, Get, Post, Put, Patch, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private checkSuperAdmin(req: any) {
    if (req.user.role !== 'rusertech_admin' && req.user.role !== 'super_admin') {
      throw new ForbiddenException('Acceso denegado. Solo administradores del sistema.');
    }
  }

  @Get('tenants')
  getTenants(@Request() req: any) {
    this.checkSuperAdmin(req);
    return this.adminService.getTenants();
  }

  @Post('tenants')
  createTenant(@Request() req: any, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.adminService.createTenant(body);
  }

  @Patch('tenants/:id/suspend')
  suspendTenant(@Request() req: any, @Param('id') id: string, @Body() body: { suspend: boolean }) {
    this.checkSuperAdmin(req);
    return this.adminService.suspendTenant(id, body.suspend);
  }

  @Put('tenants/:id')
  updateTenant(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.adminService.updateTenant(id, body);
  }

  @Get('tenants/:id/stats')
  getTenantStats(@Request() req: any, @Param('id') id: string) {
    this.checkSuperAdmin(req);
    return this.adminService.getTenantStats(id);
  }

  @Get('tenants/:id/users')
  getTenantUsers(@Request() req: any, @Param('id') id: string) {
    this.checkSuperAdmin(req);
    return this.adminService.getTenantUsers(id);
  }

  // --- USERS ---
  @Get('users')
  getAllUsers(@Request() req: any) {
    this.checkSuperAdmin(req);
    return this.adminService.getAllUsers();
  }

  @Get('users/credentials')
  getUsersWithPassInfo(@Request() req: any) {
    this.checkSuperAdmin(req);
    return this.adminService.getUsersWithPassInfo();
  }

  @Post('users/:id/reset-password')
  resetUserPassword(@Request() req: any, @Param('id') id: string) {
    this.checkSuperAdmin(req);
    return this.adminService.resetUserPassword(id);
  }

  @Put('users/:id')
  updateUserGlobal(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.adminService.updateUserGlobal(id, body);
  }

  // --- ROLES ---
  @Get('roles')
  getRoles(@Request() req: any) {
    this.checkSuperAdmin(req);
    return this.adminService.getRoles();
  }

  @Post('roles')
  createRole(@Request() req: any, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.adminService.createRole(body);
  }

  @Put('roles/:id')
  updateRole(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.adminService.updateRole(id, body);
  }
}
