import React from 'react';
import { Pagination as AntPagination } from 'antd';

interface PaginationProps {
    total: number;
    pageSize: number;
    current: number;
    onChange: (page: number, pageSize: number) => void;
    onSizeChange: (current: number, size: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ total, pageSize, current, onChange, onSizeChange }) => {
    return (
        <AntPagination
            total={total}
            showSizeChanger={true}
            showTotal={(total: number) => `共计 ${total} 条`}
            showTitle={false}
            pageSize={pageSize}
            current={current}
            onChange={onChange}
            onShowSizeChange={onSizeChange}
            align="end"
        />
    )
}

export default Pagination;