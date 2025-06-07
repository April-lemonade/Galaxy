import { Widget } from '@lumino/widgets';
import * as d3 from 'd3';
import type { D3ZoomEvent } from 'd3';


export class SankeyWidget extends Widget {
  constructor() {
    super();
    this.addClass('sankey-widget');
    this.node.innerHTML = '<div id="sankey-container"></div>';
    this.render();
  }

  async render() {
    const container = d3.select(this.node).select('#sankey-container');

    const response = await fetch('/galaxy/final_file');
    const raw = await response.json();

    const stages = new Set<string>();
    const matrix: { row: number; col: number; stage: string | null }[] = [];
    const colorMap = new Map<string, string>();
    const palette = d3.schemeSet2;

    raw.notebooks.forEach((nb: any, nbIndex: number) => {
      nb.cells.forEach((cell: any, rowIndex: number) => {
        matrix.push({
          row: rowIndex,
          col: nbIndex,
          stage: cell.class ?? null
        });
        if (cell.class) stages.add(cell.class);
      });
    });

    Array.from(stages).forEach((s, i) => {
      colorMap.set(s, palette[i % palette.length]);
    });


    type Cell = { row: number; col: number; stage: string | null };

    const cellHeight = 6;
    const cellWidth = 5;
    const padding = 40;
    const notebookCount = d3.max(matrix, (d: Cell) => d.col)! + 1;
    const rowCount = d3.max(matrix, (d: Cell) => d.row)! + 1;
    const height = rowCount * cellHeight + 60;
    const cellSpacing = 60;
    const x = (col: number) => padding + col * cellSpacing;
    const lastColX = padding + (notebookCount - 1) * cellSpacing;
    const width = lastColX + cellWidth + padding;
    const allStages = Array.from(new Set(matrix.map((d) => d.stage)));

    const svg = container
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .style('max-width', '100%')
      .style('height', 'auto')
      .style('font', '10px sans-serif');

    const mainGroup = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        mainGroup.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    const layout: Record<number, Record<string, { y0: number; y1: number }[]>> = {};
    for (let col = 0; col < notebookCount; col++) {
      layout[col] = {};
      const colCells = matrix.filter((d) => d.col === col);
      let currentStage: string | null = null;
      let startRow: number | null = null;

      for (let i = 0; i < colCells.length; i++) {
        const cell = colCells[i];
        if (cell.stage !== currentStage) {
          if (currentStage !== null && startRow !== null) {
            layout[col][currentStage] = layout[col][currentStage] || [];
            layout[col][currentStage].push({
              y0: startRow * cellHeight + 40,
              y1: i * cellHeight + 40
            });
          }
          currentStage = cell.stage;
          startRow = i;
        }
      }
      if (currentStage !== null && startRow !== null) {
        layout[col][currentStage] = layout[col][currentStage] || [];
        layout[col][currentStage].push({
          y0: startRow * cellHeight + 40,
          y1: colCells.length * cellHeight + 40
        });
      }
    }


    mainGroup
      .append('g')
      .selectAll<SVGRectElement, { row: number; col: number; stage: string | null }>('rect')
      .data(matrix)
      .join('rect')
      .attr('x', (d: Cell) => x(d.col))
      .attr('y', (d: Cell) => d.row * cellHeight + 40)
      .attr('width', cellWidth)
      .attr('height', cellHeight)
      .attr('fill', (d: Cell) => (d.stage ? colorMap.get(d.stage) || '#ccc' : '#ccc'));

    const links: any[] = [];
    for (let col = 0; col < notebookCount - 1; col++) {
      const thisCol = layout[col];
      const nextCol = layout[col + 1];
      for (const stage of allStages) {
        if (stage === null) continue;
        const from = thisCol[stage] || [];
        const to = nextCol[stage] || [];
        const count = Math.min(from.length, to.length);
        for (let i = 0; i < count; i++) {
          links.push({
            stage,
            sourceCol: col,
            targetCol: col + 1,
            source: from[i],
            target: to[i]
          });
        }
      }
    }

    type Link = {
      stage: string;
      sourceCol: number;
      targetCol: number;
      source: { y0: number; y1: number };
      target: { y0: number; y1: number };
    };

    mainGroup
      .append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('d', (d: Link) => {
        const x0 = x(d.sourceCol) + cellWidth + 1;
        const x1 = x(d.targetCol) - 1;
        const y00 = d.source.y0;
        const y01 = d.source.y1;
        const y10 = d.target.y0;
        const y11 = d.target.y1;
        const xm = (x0 + x1) / 2;
        return `
          M${x0},${y00}
          C${xm},${y00} ${xm},${y10} ${x1},${y10}
          L${x1},${y11}
          C${xm},${y11} ${xm},${y01} ${x0},${y01}
          Z
        `;
      })
      .attr('fill', (d: Link) => colorMap.get(d.stage) || '#ccc')
      .attr('fill-opacity', 0.4)
      .attr('stroke', 'none');

    mainGroup
      .append('g')
      .selectAll('text')
      .data(d3.range(notebookCount))
      .join('text')
      .attr('x', (d: number) => x(d) + cellWidth / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .text((d: number) => `Notebook ${d + 1}`);
  }
}