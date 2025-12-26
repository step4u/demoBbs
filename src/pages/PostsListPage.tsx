import React, { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
    ColDef,
    GridApi,
    GridReadyEvent,
    IDatasource,
    IGetRowsParams,
} from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import "./posts-grid.css";

type Post = {
    id: number;
    title: string;
    author: string;
    createdAt: string; // ISO
    views: number;
};

type PageResponse<T> = {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
};

const API_BASE = "http://localhost:8088";

export default function PostsListPage() {
    const gridApiRef = useRef<GridApi | null>(null);

    const [pageSize, setPageSize] = useState<number>(10);
    const pageSizeOptions = [10, 20, 50, 100];

    const columnDefs = useMemo<ColDef<Post>[]>(
        () => [
            { field: "id", headerName: "ID", width: 90 },
            { field: "title", headerName: "제목", flex: 1, minWidth: 260 },
            { field: "author", headerName: "작성자", width: 140 },
            {
                field: "createdAt",
                headerName: "작성일",
                width: 170,
                valueFormatter: (p) =>
                    p.value ? new Date(p.value).toLocaleString() : "",
            },
            { field: "views", headerName: "조회수", width: 120 },
        ],
        []
    );

    const defaultColDef = useMemo<ColDef>(
        () => ({
            sortable: true,
            filter: true,
            resizable: true,
        }),
        []
    );

    const buildDatasource = useCallback(
        (): IDatasource => ({
            // Infinite Row Model은 getRows로 필요한 구간(startRow~endRow)을 요청합니다.
            getRows: async (params: IGetRowsParams) => {
                try {
                    const startRow = params.startRow ?? 0;
                    const endRow = params.endRow ?? startRow + pageSize;

                    // ag-grid가 요구하는 구간을 서버 "page/size"로 환산
                    const size = pageSize;
                    const page = Math.floor(startRow / size);

                    const res = await fetch(
                        `${API_BASE}/api/posts?page=${page}&size=${size}`
                    );
                    if (!res.ok) throw new Error("API error");

                    const data: PageResponse<Post> = await res.json();

                    // lastRow: 전체 건수(알면 넣고, 모르면 -1)
                    params.successCallback(data.content, data.totalElements);
                } catch (e) {
                    params.failCallback();
                }
            },
        }),
        [pageSize]
    );

    const onGridReady = useCallback(
        (e: GridReadyEvent) => {
            gridApiRef.current = e.api;

            // pageSize에 맞춰 캐시 블록도 맞추면 "페이지=블록" 느낌으로 동작합니다.
            e.api.setGridOption("cacheBlockSize", pageSize);
            e.api.setGridOption("paginationPageSize", pageSize);
            e.api.setDatasource(buildDatasource());
        },
        [pageSize, buildDatasource]
    );

    const onChangePageSize = (next: number) => {
        setPageSize(next);

        const api = gridApiRef.current;
        if (!api) return;

        api.setGridOption("cacheBlockSize", next);
        api.setGridOption("paginationPageSize", next);

        // 캐시 비우고 1페이지부터 다시 로딩
        api.paginationGoToFirstPage();
        api.purgeInfiniteCache();
    };

    return (
        <div style={{ padding: 16 }}>
            <h2 style={{ marginBottom: 12 }}>게시물 목록</h2>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <label>pageSize</label>
                <select
                    value={pageSize}
                    onChange={(e) => onChangePageSize(Number(e.target.value))}
                >
                    {pageSizeOptions.map((n) => (
                        <option key={n} value={n}>
                            {n}개
                        </option>
                    ))}
                </select>
            </div>

            <div className="ag-theme-quartz" style={{ height: 600, width: "100%" }}>
                <AgGridReact<Post>
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowModelType="infinite"
                    // pagination
                    pagination={true}
                    paginationPageSize={pageSize}
                    // (옵션) ag-grid 기본 page size selector도 쓰고 싶으면:
                    paginationPageSizeSelector={pageSizeOptions}
                    onGridReady={onGridReady}
                />
            </div>
        </div>
    );
}
