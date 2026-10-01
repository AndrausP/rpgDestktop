"""Indexar os Markdown canônicos no grafo da raiz, preservando nós AST.

Extrai apenas títulos, parágrafos, linhas de tabelas e links presentes nos
arquivos. Não cria relações sem uma ligação explícita no texto.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from graphify.build import build_merge
from graphify.cluster import cluster
from graphify.export import to_json


ROOT = Path(__file__).resolve().parent.parent
GRAPH = ROOT / "graphify-out" / "graph.json"
DOCUMENTS = [
    "docs/README.md",
    "docs/architecture.md",
    "docs/modules.md",
    "docs/data-model.md",
    "docs/decisions.md",
    "docs/knowledge/errors-aprendidos.md",
    "docs/knowledge/pending-validation.md",
]
LINK = re.compile(r"\[[^]]+\]\(([^)]+)\)")
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


def plain(value: str) -> str:
    value = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", value)
    value = value.replace("`", "").replace("**", "")
    return re.sub(r"\s+", " ", value).strip(" |*#")


def token(path: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", path.lower()).strip("_")


def make_node(node_id: str, label: str, source: str, line: int, rationale: str) -> dict:
    return {
        "id": node_id,
        "label": label[:160],
        "file_type": "concept",
        "source_file": source,
        "source_location": str(line),
        "rationale": rationale[:2000],
        "_origin": "semantic",
    }


def make_edge(source: str, target: str, file: str, line: int, relation: str) -> dict:
    return {
        "source": source,
        "target": target,
        "relation": relation,
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "weight": 1.0,
        "source_file": file,
        "source_location": str(line),
        "_origin": "semantic",
    }


def code_file_nodes(graph: dict) -> dict[str, str]:
    """Find the AST file node for a linked source path, when one exists."""
    result = {}
    for node in graph.get("nodes", []):
        source = node.get("source_file", "").replace("\\", "/")
        if (
            node.get("file_type") == "code"
            and node.get("label") == Path(source).name
            and source not in result
        ):
            result[source] = node["id"]
    return result


def extract(graph: dict) -> dict:
    nodes: list[dict] = []
    edges: list[dict] = []
    doc_ids = {file: "document_" + token(file) for file in DOCUMENTS}
    code_ids = code_file_nodes(graph)

    for file in DOCUMENTS:
        path = ROOT / file
        lines = path.read_text(encoding="utf-8").splitlines()
        doc_id = doc_ids[file]
        title = plain(lines[0]) if lines else file
        nodes.append(make_node(doc_id, title, file, 1, f"Documento canônico: {file}"))
        section_id = doc_id
        section_name = title
        block: list[str] = []
        block_start = 0

        def flush() -> None:
            nonlocal block, block_start
            if not block:
                return
            raw = "\n".join(block).strip()
            block = []
            if not raw:
                return
            if raw.startswith("|"):
                if re.fullmatch(r"[| :\-]+", raw):
                    return
                cells = [plain(cell) for cell in raw.strip("|").split("|")]
                if cells and cells[0] in {"Data", "Área", "Assunto"}:
                    return
                subject = cells[1] if file.endswith("decisions.md") and len(cells) > 1 else cells[0]
                label = f"{section_name}: {subject}"
            elif raw.startswith("```"):
                label = f"{section_name}: estrutura em disco"
            else:
                label = f"{section_name}: {plain(raw)}"
            fact_id = f"fact_{token(file)}_{block_start}"
            nodes.append(make_node(fact_id, label, file, block_start, raw))
            edges.append(make_edge(section_id, fact_id, file, block_start, "contains"))

            for link in LINK.findall(raw):
                if "://" in link or link.startswith("#"):
                    continue
                target_path = link.split("#", 1)[0]
                if not target_path:
                    continue
                target = (path.parent / target_path).resolve()
                try:
                    relative = target.relative_to(ROOT).as_posix()
                except ValueError:
                    continue
                target_id = doc_ids.get(relative) or code_ids.get(relative)
                if target_id and target_id != fact_id:
                    edges.append(make_edge(fact_id, target_id, file, block_start, "references"))

        for line_no, line in enumerate(lines, 1):
            match = HEADING.match(line)
            if match:
                flush()
                if line_no == 1:
                    continue
                section_name = plain(match.group(2))
                section_id = f"section_{token(file)}_{line_no}"
                nodes.append(make_node(section_id, f"{title}: {section_name}", file, line_no, line))
                edges.append(make_edge(doc_id, section_id, file, line_no, "contains"))
                continue
            if not line.strip():
                flush()
                continue
            if line.lstrip().startswith("|"):
                flush()
                block_start = line_no
                block = [line]
                flush()
                continue
            if not block:
                block_start = line_no
            block.append(line)
        flush()

    # Repetições literais de links em uma linha podem gerar arestas idênticas.
    unique_edges = list({
        (edge["source"], edge["target"], edge["relation"], edge["source_file"], edge["source_location"]): edge
        for edge in edges
    }.values())
    return {"nodes": nodes, "edges": unique_edges, "hyperedges": [], "input_tokens": 0, "output_tokens": 0}


def main() -> None:
    if not GRAPH.is_file():
        raise SystemExit("Índice raiz ausente: execute primeiro graphify update .")
    previous = json.loads(GRAPH.read_text(encoding="utf-8"))
    extracted = extract(previous)
    graph = build_merge(
        [extracted], graph_path=GRAPH, root=ROOT, dedup=False,
    )
    communities = cluster(graph)
    if not to_json(graph, communities, str(GRAPH)):
        raise SystemExit("Graphify recusou reduzir o índice; grafo anterior preservado.")
    print(
        f"Documentos indexados: {len(DOCUMENTS)}; "
        f"{len(extracted['nodes'])} nós e {len(extracted['edges'])} relações extraídos; "
        f"grafo raiz: {graph.number_of_nodes()} nós, {graph.number_of_edges()} relações."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Falha ao indexar documentos: {error}", file=sys.stderr)
        raise
