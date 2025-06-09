import { Widget } from '@lumino/widgets';
import * as d3 from 'd3';
import type { D3ZoomEvent } from 'd3';

type Cell = { row: number; col: number; stage: string | null };

export class SankeyWidget extends Widget {
  private result: any;

  constructor(result: any) {
    super();
    this.addClass('sankey-widget');
    this.node.innerHTML = '<div id="sankey-container"></div>';
    this.result = result;
    this.render();
  }

  async render() {
    const container = d3.select(this.node).select('#sankey-container');
    // const response = await fetch('/galaxy/final_file');
    // const raw = await response.json();
    const raw = this.result;

    const matrix: Cell[] = [];
    const stages = new Set<string>();
    const colorMap = new Map<string, string>();
    const palette = d3.schemeSet2;

    raw.notebooks.forEach((nb: any, colIndex: number) => {
      nb.cells.forEach((cell: any, rowIndex: number) => {
        matrix.push({ row: rowIndex, col: colIndex, stage: cell.class ?? null });
        if (cell.class) stages.add(cell.class);
      });
    });

    Array.from(stages).forEach((s, i) => {
      colorMap.set(s, palette[i % palette.length]);
    });

    let notebookOrder = Array.from(new Set(matrix.map(d => d.col)));

    const draw = () => {
      container.selectAll('*').remove();

      const notebookCount = notebookOrder.length;
      const rowCount = d3.max(matrix, (d) => d.row)! + 1;
      const cellHeight = 6;
      const cellWidth = 5;
      const padding = 40;
      const cellSpacing = 60;
      const height = rowCount * cellHeight + 60;
      const x = (col: number) => padding + notebookOrder.indexOf(col) * cellSpacing;
      const width = x(notebookOrder[notebookCount - 1]) + cellWidth + padding;

      const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('font', '10px sans-serif');

      const mainGroup = svg.append('g');

      svg.call(
        d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.5, 5])
          .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
            mainGroup.attr('transform', event.transform.toString());
          })
      );

      const layout: Record<number, Record<string, { y0: number; y1: number }[]>> = {};
      for (const col of notebookOrder) {
        layout[col] = {};
        const colCells = matrix.filter((d) => d.col === col);
        let currentStage: string | null = null;
        let startRow: number | null = null;

        for (let i = 0; i < colCells.length; i++) {
          const cell = colCells[i];
          if (cell.stage !== currentStage) {
            if (currentStage !== null && startRow !== null) {
              layout[col][currentStage] = layout[col][currentStage] || [];
              layout[col][currentStage].push({ y0: startRow * cellHeight + 40, y1: i * cellHeight + 40 });
            }
            currentStage = cell.stage;
            startRow = i;
          }
        }
        if (currentStage !== null && startRow !== null) {
          layout[col][currentStage] = layout[col][currentStage] || [];
          layout[col][currentStage].push({ y0: startRow * cellHeight + 40, y1: colCells.length * cellHeight + 40 });
        }
      }

      // Rects
      mainGroup.append('g')
        .selectAll('rect')
        .data(matrix)
        .join('rect')
        .attr('x', (d) => x(d.col))
        .attr('y', (d) => d.row * cellHeight + 40)
        .attr('width', cellWidth)
        .attr('height', cellHeight)
        .attr('fill', (d) => (d.stage ? colorMap.get(d.stage) || '#ccc' : '#ccc'));

      // Links
      const links: any[] = [];
      const allStages = Array.from(stages);
      for (let i = 0; i < notebookCount - 1; i++) {
        const a = notebookOrder[i];
        const b = notebookOrder[i + 1];
        for (const stage of allStages) {
          const from = layout[a][stage] || [];
          const to = layout[b][stage] || [];
          const count = Math.min(from.length, to.length);
          for (let j = 0; j < count; j++) {
            links.push({ stage, sourceCol: a, targetCol: b, source: from[j], target: to[j] });
          }
        }
      }

      mainGroup.append('g')
        .selectAll('path')
        .data(links)
        .join('path')
        .attr('d', (d) => {
          const x0 = x(d.sourceCol) + cellWidth + 1;
          const x1 = x(d.targetCol) - 1;
          const y00 = d.source.y0;
          const y01 = d.source.y1;
          const y10 = d.target.y0;
          const y11 = d.target.y1;
          const xm = (x0 + x1) / 2;
          return `M${x0},${y00}C${xm},${y00} ${xm},${y10} ${x1},${y10}L${x1},${y11}C${xm},${y11} ${xm},${y01} ${x0},${y01}Z`;
        })
        .attr('fill', (d) => colorMap.get(d.stage) || '#ccc')
        .attr('fill-opacity', 0.4);

      // Labels + Drag (only when shift held)
      const labels = mainGroup.append('g')
        .selectAll<SVGTextElement, number>('text')
        .data(notebookOrder)
        .join('text')
        .attr('x', (d) => x(d) + cellWidth / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('cursor', 'pointer')
        .text((d) => `Notebook ${d + 1}`);

      const drag = d3.drag<SVGTextElement, number>()
        .on('start', function (event) {
          if (!event.sourceEvent.shiftKey) return;
          d3.select(this).raise().attr('stroke', 'black');
        })
        .on('drag', function (event, d) {
          if (!event.sourceEvent.shiftKey) return;
          d3.select(this).attr('x', event.x);
        })
        .on('end', function (event, d) {
          if (!event.sourceEvent.shiftKey) return;
          const newIndex = Math.floor((event.x - padding) / cellSpacing);
          const oldIndex = notebookOrder.indexOf(d);
          if (newIndex !== oldIndex && newIndex >= 0 && newIndex < notebookCount) {
            notebookOrder.splice(oldIndex, 1);
            notebookOrder.splice(newIndex, 0, d);
            draw();
          }
        });

      labels.call(drag);

      // Tooltip
      const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip-div')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.75)')
        .style('padding', '5px')
        .style('border', '1px solid #ccc')
        .style('display', 'none');

      mainGroup.selectAll<SVGRectElement, Cell>('rect')
        .on('mouseover', (event, d: Cell) => {
          tooltip
            .style('display', 'block')
            .html(`Stage: ${d.stage ?? 'None'}<br>Cell: ${d.row}<br>Notebook: ${d.col + 1}`);
        })
        .on('mousemove', (event) => {
          tooltip.style('left', `${event.pageX + 10}px`).style('top', `${event.pageY + 10}px`);
        })
        .on('mouseout', () => {
          tooltip.style('display', 'none');
        });

      // Legend
      const legend = svg.append('g')
        .attr('transform', `translate(${padding}, ${height - 20})`);
      const legendItems = Array.from(colorMap.entries());
      legend.selectAll('rect')
        .data(legendItems)
        .join('rect')
        .attr('x', (_, i) => i * 150)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', ([, color]) => color);
      legend.selectAll('text')
        .data(legendItems)
        .join('text')
        .attr('x', (_, i) => i * 150 + 16)
        .attr('y', 10)
        .text(([stage]) => stage)
        .attr('alignment-baseline', 'middle');
    };

    draw();
  }
}