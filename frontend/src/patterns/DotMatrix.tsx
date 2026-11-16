import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useCountUp } from "../motion/useCountUp";
import { dotScale } from "./dotScale";

type DotColumn = {
    key: string;
    label: string;
    count: number;
    stale: number;
    color: string;
    to?: string;
};

function Column({
    column,
    dots,
    staleDots,
    offset,
}: {
    column: DotColumn;
    dots: number;
    staleDots: number;
    offset: number;
}) {
    const count = useCountUp(column.count, { delay: 400 });
    const body = (
        <>
            <span
                className="dot-matrix-dots"
                style={{ "--c": column.color } as CSSProperties}
                aria-hidden="true"
            >
                {Array.from({ length: dots }, (_, index) => (
                    <i
                        key={index}
                        className={`motion-pop${index < staleDots ? " is-stale" : ""}`}
                        style={{ "--i": offset + index } as CSSProperties}
                    />
                ))}
            </span>
            <span className="dot-matrix-label">
                <b>{count}</b>
                <span>{column.label}</span>
            </span>
        </>
    );
    return column.to ? (
        <Link className="dot-matrix-column is-link" to={column.to}>
            {body}
        </Link>
    ) : (
        <div className="dot-matrix-column">{body}</div>
    );
}

export default function DotMatrix({
    columns,
    unit,
}: {
    columns: DotColumn[];
    unit: { one: string; many: string };
}) {
    const scale = dotScale(
        columns.map((column) => column.count),
        columns.map((column) => column.stale),
    );
    const legend =
        scale.perDot === 1 ? `1 ponto = 1 ${unit.one}` : `1 ponto = ${scale.perDot} ${unit.many}`;
    let offset = 0;
    return (
        <div className="dot-matrix">
            <span className="dot-matrix-legend micro">{legend}</span>
            <div className="dot-matrix-grid" style={{ "--cols": columns.length } as CSSProperties}>
                {columns.map((column, index) => {
                    const start = offset;
                    offset += scale.dots[index];
                    return (
                        <Column
                            key={column.key}
                            column={column}
                            dots={scale.dots[index]}
                            staleDots={scale.staleDots[index]}
                            offset={start}
                        />
                    );
                })}
            </div>
        </div>
    );
}
