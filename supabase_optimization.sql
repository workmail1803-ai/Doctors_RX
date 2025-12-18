-- Optimization: Fix RLS Performance & Multiple Permissive Policies
-- Based on Supabase Linter Recommendations

-- ==========================================
-- 1. PROFILES
-- ==========================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users view own profile" ON profiles
    FOR SELECT USING (
        (select auth.uid()) = id
    );

CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE USING (
        (select auth.uid()) = id
    );

CREATE POLICY "Users insert own profile" ON profiles
    FOR INSERT WITH CHECK (
        (select auth.uid()) = id
    );

-- ==========================================
-- 2. PRESCRIPTIONS
-- ==========================================
DROP POLICY IF EXISTS "Doctors can view own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Doctors can insert own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Doctors can update own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Doctors can delete own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Patients view own prescriptions" ON prescriptions;

-- Unified SELECT Policy (Doctors view own created, Patients view own assigned)
CREATE POLICY "Users view access prescriptions" ON prescriptions
    FOR SELECT USING (
        (select auth.uid()) = doctor_id OR
        (select auth.uid()) = patient_id
    );

-- Doctor Management Policies
CREATE POLICY "Doctors insert own prescriptions" ON prescriptions
    FOR INSERT WITH CHECK (
        (select auth.uid()) = doctor_id
    );

CREATE POLICY "Doctors update own prescriptions" ON prescriptions
    FOR UPDATE USING (
        (select auth.uid()) = doctor_id
    );

CREATE POLICY "Doctors delete own prescriptions" ON prescriptions
    FOR DELETE USING (
        (select auth.uid()) = doctor_id
    );

-- ==========================================
-- 3. APPOINTMENTS
-- ==========================================
DROP POLICY IF EXISTS "Patients view own appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors view assigned appointments" ON appointments;
DROP POLICY IF EXISTS "Assistants view all appointments" ON appointments;
DROP POLICY IF EXISTS "Assistants see all appointments" ON appointments;

-- Unified SELECT Policy
CREATE POLICY "Users view access appointments" ON appointments
    FOR SELECT USING (
        (select auth.uid()) = patient_id OR
        (select auth.uid()) = doctor_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'assistant')
    );

DROP POLICY IF EXISTS "Patients insert own appointments" ON appointments;
CREATE POLICY "Patients insert own appointments" ON appointments
    FOR INSERT WITH CHECK (
        (select auth.uid()) = patient_id
    );

DROP POLICY IF EXISTS "Assistants update appointments" ON appointments;
DROP POLICY IF EXISTS "Participants update signaling" ON appointments;

-- Unified UPDATE Policy (Assistants manage, Participants update signal)
-- Note: Splitting might be cleaner if permissions differ widely, but combining reduces overhead if columns aren't restricted.
-- However, "Participants update signaling" usually implies they can only touch specific cols, but Postgres RLS is row-based.
-- If we want to strictly separate logic, we keep them separate but optimized. 
-- Lint complained about "Multiple Permissive Policies" for UPDATE.
-- So we SHOULD combine them if possible, OR accept the warning if logic is distinct.
-- "Assistants update" allows updating ANY column. "Participants" allows updating ANY column (row-based).
-- So effectively, if you are a patient, you can update the ROW.
-- Let's combine.

CREATE POLICY "Users update access appointments" ON appointments
    FOR UPDATE USING (
        (select auth.uid()) = patient_id OR
        (select auth.uid()) = doctor_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'assistant')
    );

-- ==========================================
-- 4. PATIENT REPORTS
-- ==========================================
DROP POLICY IF EXISTS "Patients manage own reports" ON patient_reports;
DROP POLICY IF EXISTS "Doctors view reports" ON patient_reports;

-- Unified SELECT
CREATE POLICY "Users view access reports" ON patient_reports
    FOR SELECT USING (
        (select auth.uid()) = patient_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'doctor')
    );

-- Patient Insert/Update/Delete (Manage)
CREATE POLICY "Patients manage own reports" ON patient_reports
    FOR ALL USING (
        (select auth.uid()) = patient_id
    ) WITH CHECK (
        (select auth.uid()) = patient_id
    );

-- ==========================================
-- 5. PRESCRIPTION TEMPLATES
-- ==========================================
DROP POLICY IF EXISTS "Doctors manage own templates" ON prescription_templates;

CREATE POLICY "Doctors manage own templates" ON prescription_templates
    FOR ALL USING (
        (select auth.uid()) = doctor_id
    ) WITH CHECK (
        (select auth.uid()) = doctor_id
    );
