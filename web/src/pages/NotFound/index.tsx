import { Button } from "antd";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import './style.css';

const NotFound: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="not-found">
            <h1>{t('notFound.title')}</h1>
            <p>{t('notFound.message')}</p>
            <Button type="primary" onClick={() => navigate('/')}>
                {t('notFound.backToHome')}
            </Button>
        </div>
    )
}

export default NotFound;