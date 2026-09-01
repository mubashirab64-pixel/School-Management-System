# Al-Khair SMS - Version History & Changelog

All notable changes to this project will be documented in this file.

---

## [v3.3.5] - 2026-05-02
### Added
- **Teacher Bulk Import**: Implemented a complete workflow for importing teachers via Excel/CSV.
- **Import Dashboard**: Added an interactive reporting dashboard to show success and failure counts during bulk import.
- **Validation**: Enforced unique constraints for Email and CNIC during teacher creation and import.

### Changed
- **Student List UI**: Replaced granular 'Grade/Section' columns with a consolidated 'Current Classroom' view for better clarity.
- **Filter Logic**: Standardized campus and shift filtering across the administrative portal.
- **Teacher Classroom Selection**: Optimized the grade filtering to be shift-aware, preventing duplicate list entries.

### Database Changes (SQL Queries)
- Added unique index on `teachers` table for `email` and `cnic`.
- `CREATE UNIQUE INDEX idx_teachers_email ON teachers(email);`
- `CREATE UNIQUE INDEX idx_teachers_cnic ON teachers(cnic);`

---

## [v3.3.4] - 2026-04-27
### Added
- **Coordinator Analytics Export**: Implemented CSV export functionality for coordinators and administrators.
- **Role-Based Access (RBAC)**: Restricted data export features to `org-admin` and `principal` roles.

### Fixed
- **Data Refresh Issue**: Resolved UI staleness by implementing React Query cache invalidation after CRUD operations.
- **Export Button**: Fixed the missing export button on the Principal Dashboard.

### Technical
- Optimized frontend data refetching strategies to ensure immediate UI updates.

---

## [v3.0.0] - 2026-04-20 (Initial Release)
- Base implementation of School Management System.
- Core modules: Students, Teachers, Classrooms, and User Authentication.
