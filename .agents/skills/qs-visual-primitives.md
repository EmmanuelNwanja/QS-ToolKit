# Skill: qs-visual-primitives

Spatial reasoning for architectural drawing analysis using visual primitives.

## Primitive Types

### box — Room/Space Bounding Box
```
<|ref|>Living Room<|/ref|><|box|>[[x1,y1,x2,y2]]<|/box|>
```
- Normalized coordinates 0–999
- Represents room boundaries on floor plan

### poly — Wall/Room Polygon
```
<|ref|>Wall-L1<|/ref|><|poly|>[[x1,y1,x2,y2,...,xn,yn]]<|/poly|>
```
- Polygon vertices in clockwise order
- Used for wall area, plastering, painting quantities

### point — Door/Window/Center Marker
```
<|ref|>Door-D1<|/ref|><|point|>[[x,y]]<|/point|>
```
- Center point of fixture
- Cross-references to dimension lines

### line — Dimension/Axis Line
```
<|ref|>Dim-L1<|/ref|><|line|>[[x1,y1,x2,y2]]<|/line|>
```
- Dimension line with label (extracted via OCR)
- Wall axis for structural analysis

## Interleaving Format

The model reasons in natural language but interleaves primitives as "minimal units of thought":

```
I see a <|ref|>floor plan<|/ref|> with the following rooms:
- <|ref|>Living Room<|/ref|><|box|>[[120,80,450,320]]<|/box|> measuring 5.2m × 4.1m
- <|ref|>Kitchen<|/ref|><|box|>[[460,80,650,250]]<|/box|> measuring 3.0m × 2.4m

The north wall of the living room is <|ref|>Wall-L1<|/ref|><|poly|>[[120,80,450,80,450,100,120,100]]<|/poly|>.
Its length is confirmed by dimension line <|ref|>Dim-L1<|/ref|><|line|>[[120,60,450,60]]<|/line|> labeled "5200".
```

## Cross-Reference Resolution

After parsing, resolve:
- `room.primitiveId` → box primitive
- `wall.primitiveId` → poly primitive
- `element.primitiveId` → point/box primitive
- `dimension.primitiveId` → line primitive

## Confidence Scoring

Each primitive gets a confidence score 0.0–1.0:
- ≥0.9: High confidence — auto-accept
- 0.7–0.89: Medium — show to user
- <0.7: Low — flag for manual verification
