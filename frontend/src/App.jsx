import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Login } from '@/pages/Login';
import { RegisterSelect } from '@/pages/Register';
import { StudentRegister } from '@/pages/Register/StudentRegister';
import { ProfessorRegister } from '@/pages/Register/ProfessorRegister';
import { CoordinatorRegister } from '@/pages/Register/CoordinatorRegister';
import { Dashboard } from '@/pages/Dashboard';
import { StudentsList } from '@/pages/Students';
import { Analytics } from '@/pages/Analytics';
import { Predictions } from '@/pages/Predictions';
import { Recommendations } from '@/pages/Recommendations';
import { AIInsights } from '@/pages/AIInsights';
import { StudentDashboard } from '@/pages/StudentDashboard';
import { ProfessorDashboard } from '@/pages/ProfessorDashboard';
import { ProfessorCourses } from '@/pages/ProfessorCourses';
import { ProfessorProfile } from '@/pages/ProfessorProfile';
import { StudentProfile } from '@/pages/StudentProfile';
import { HistoricalData } from '@/pages/HistoricalData';
import { CoordinatorDashboard } from '@/pages/CoordinatorDashboard';
import { AnalysisCenter } from '@/pages/AnalysisCenter';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Público */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<RegisterSelect />} />
                    <Route path="/register/student" element={<StudentRegister />} />
                    <Route path="/register/professor" element={<ProfessorRegister />} />
                    <Route path="/register/coordinator" element={<CoordinatorRegister />} />

                    {/* Protegido */}
                    <Route path="/" element={<Layout />}>
                        {/* Admin/Coordinator/Viewer routes */}
                        <Route index element={<Dashboard />} />
                        <Route path="students" element={<StudentsList />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="predictions" element={<Predictions />} />
                        <Route path="recommendations" element={<Recommendations />} />
                        <Route path="ai-insights" element={<AIInsights />} />

                        {/* Student routes */}
                        <Route path="student/dashboard" element={<StudentDashboard />} />
                        <Route path="student/profile" element={<StudentProfile />} />

                        {/* Professor routes */}
                        <Route path="professor/dashboard" element={<ProfessorDashboard />} />
                        <Route path="professor/courses" element={<ProfessorCourses />} />
                        <Route path="professor/profile" element={<ProfessorProfile />} />
                        <Route path="professor/historical-data" element={<HistoricalData />} />
                        <Route path="professor/analysis-center" element={<AnalysisCenter />} />

                        {/* Coordinator routes */}
                        <Route path="coordinator/dashboard" element={<CoordinatorDashboard />} />
                        <Route path="coordinator/analysis-center" element={<AnalysisCenter />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
