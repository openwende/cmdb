import { Button } from "antd";
import React from "react";
import { useNavigate } from "react-router-dom";

const NotFound:React.FC = () => {
    const navigate = useNavigate();

    return (
        <div>
            <h1>404</h1>
            <p>抱歉，您访问的页面不存在。</p>
            <Button type="primary" onClick={() => navigate('/')}>返回首页</Button>
        </div>
    )
}

export default NotFound;