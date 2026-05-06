import React from "react";
import { useParams, Navigate } from "react-router-dom";
import BaseReportPage from "./BaseReportPage";
import { reportRegistry } from "./ReportRegistry";

const ReportViewer: React.FC = () => {
    const { reportId } = useParams<{ reportId: string }>();

    if (!reportId || !reportRegistry[reportId]) {
        return <Navigate to="/reports" replace />;
    }

    const config = reportRegistry[reportId];

    return (
        <BaseReportPage 
            title={config.title}
            reportId={reportId}
            endpoint={config.endpoint}
            columns={config.columns}
            showTaxFilter={config.showTaxFilter}
        />
    );
};

export default ReportViewer;
