# Molang TypeScript 引擎

本目录是从 `.ref/TouhouLittleMaid-1.20/src/main/java/com/github/tartaricacid/touhoulittlemaid/molang` 迁移而来的 TypeScript 版 Molang 解析与求值实现。

## 架构

```text
engin/
├─ index.ts           # 统一导出入口
├─ engine.ts          # MolangEngine，对外 parse 入口
├─ lexer.ts           # 字符串到 Token 流
├─ parser.ts          # Token 流到 AST 表达式
├─ ast.ts             # 表达式节点、访问者、运算符优先级
├─ runtime.ts         # 表达式求值器、函数参数、类型转换、标准函数
├─ runtime-types.ts   # 运行时接口：函数、变量、绑定、结构体
├─ binding.ts         # 创建 ObjectBinding / 变量的辅助工具
└─ types.ts           # TokenKind、Token、Cursor、ParseException
```

处理流程：

```text
Molang 源码字符串
  -> MolangLexer
  -> Token[] / Token 流
  -> MolangParser
  -> Expression[] AST
  -> ExpressionEvaluatorImpl
  -> number / string / boolean / struct / null 等运行时值
```

## 原理

### 词法分析

`MolangLexer` 按字符读取源字符串并输出 `Token`：

- 字面量：数字、单引号字符串、`true`、`false`
- 标识符：大小写不敏感，会统一转成小写
- 关键字：`break`、`continue`、`return`
- 运算符：`!`、`&&`、`||`、`<`、`<=`、`>`、`>=`、`=`、`==`、`!=`、`+`、`-`、`*`、`/`、`??`、`?`、`:`、`->`
- 分隔符：`.`、`,`、`;`、`()`、`{}`、`[]`

### 语法分析

`MolangParser` 使用 Pratt / precedence climbing 思路解析表达式。核心优先级与 Java 版保持一致：

| 运算 | 优先级 |
| --- | ---: |
| `->` | 3000 |
| 一元 `!` / `-` / `+` | 2800 |
| `*` / `/` | 2600 |
| `+` / `-` | 2400 |
| `<` / `<=` / `>` / `>=` | 2200 |
| `==` / `!=` | 2000 |
| `&&` | 1800 |
| `||` | 1600 |
| `?` / `?:` | 1400 |
| `??` | 1200 |
| `=` | 1 |

解析结果是 `Expression[]`。常见节点包括：

- `DoubleExpression` / `StringExpression`
- `BinaryExpression` / `UnaryExpression`
- `TernaryConditionalExpression`
- `IdentifierExpression`
- `VariableExpression` / `AssignableVariableExpression`
- `CallExpression`
- `ExecutionScopeExpression`
- `StructAccessExpression`

### 绑定解析

标识符在解析阶段通过 `ObjectBinding` 解析：

- `number` -> `DoubleExpression`
- `string` -> `StringExpression`
- `Variable` -> `VariableExpression`
- `AssignableVariable` -> `AssignableVariableExpression`
- `MolangFunction` -> `IdentifierExpression`，后续可被解析为函数调用
- `ObjectBinding` -> 用于解析 `math.sin` 这类命名空间访问

因此，调用 `parse` 前必须先注册 Molang 中会出现的根对象、函数或变量。

### 求值

`ExpressionEvaluatorImpl` 通过访问者模式执行 AST：

- 算术和比较会通过 `ValueConversions` 转成数值或布尔值
- 除以 0 返回 `0`
- `&&` / `||` 使用短路逻辑
- `??` 仅在左值为 `null` / `undefined` 时执行右值
- `=` 支持给 `AssignableVariableExpression` 或结构体字段赋值
- `{ ... }` 会作为执行作用域顺序执行内部表达式
- `loop` / `for_each` 位于 `StandardBindings`

## 使用方法

### 1. 只解析 AST

```ts
import {MolangEngine, createObjectBinding} from './molang/engin';

const binding = createObjectBinding({
  answer: 42,
});

const expressions = MolangEngine.fromCustomBinding(binding).parse('answer + 1;');
console.log(expressions);
```

### 2. 解析并求值

```ts
import {
  ExpressionEvaluatorImpl,
  MolangEngine,
  createObjectBinding,
  createReadonlyVariable,
} from './molang/engin';

const binding = createObjectBinding({
  query: createObjectBinding({
    life_time: createReadonlyVariable(() => 20),
  }),
});

const [expression] = MolangEngine.fromCustomBinding(binding).parse('query.life_time + 1;');
const result = ExpressionEvaluatorImpl.evaluator().eval(expression);

console.log(result); // 21
```

### 3. 注册函数

```ts
import {
  ExpressionEvaluatorImpl,
  MolangEngine,
  createMolangFunction,
  createObjectBinding,
} from './molang/engin';

const math = createObjectBinding({
  clamp: createMolangFunction((ctx, args) => {
    const value = args.getAsFloat(ctx, 0);
    const min = args.getAsFloat(ctx, 1);
    const max = args.getAsFloat(ctx, 2);
    return Math.min(Math.max(value, min), max);
  }, (size) => size === 3),
});

const binding = createObjectBinding({math});
const [expression] = MolangEngine.fromCustomBinding(binding).parse('math.clamp(2, 0, 1);');
const result = ExpressionEvaluatorImpl.evaluator().eval(expression);

console.log(result); // 1
```

### 4. 可写变量与赋值

```ts
import {
  ExpressionEvaluatorImpl,
  MolangEngine,
  createObjectBinding,
  createMemoryVariable,
} from './molang/engin';

const x = createMemoryVariable(0);
const binding = createObjectBinding({
  variable: createObjectBinding({x}),
});

const expressions = MolangEngine.fromCustomBinding(binding).parse('variable.x = 10; variable.x + 5;');
const evaluator = ExpressionEvaluatorImpl.evaluator();

for (const expression of expressions) {
  console.log(evaluator.eval(expression));
}
```

### 5. 标准函数

```ts
import {createStandardBinding} from './molang/engin';

const binding = createStandardBinding();
// 已注册：loop、for_each
```

`loop(count, { ... })` 最多执行 `1024` 次。`for_each(variable, iterable, { ... })` 会将可迭代对象的每一项赋给第一个参数变量。

## 拓展方法

### 增加根命名空间

```ts
const root = createObjectBinding({
  query: createObjectBinding(),
  variable: createObjectBinding(),
  math: createObjectBinding(),
});
```

### 增加只读变量

```ts
query.setProperty('health', createReadonlyVariable((ctx) => {
  return (ctx.entity() as {health?: number} | null)?.health ?? 0;
}));
```

### 增加可写变量

```ts
const state = {speed: 0};
variable.setProperty('speed', createWritableVariable(
  () => state.speed,
  (_ctx, value) => { state.speed = Number(value) || 0; },
));
```

### 增加函数

推荐通过 `createMolangFunction` 创建函数。函数接收原始表达式参数集合，可以延迟求值或多次求值：

```ts
math.setProperty('max', createMolangFunction(
  (ctx, args) => Math.max(args.getAsFloat(ctx, 0), args.getAsFloat(ctx, 1)),
  (size) => size === 2,
));
```

### 增加 AST 访问器

如果只想把 Molang 转换成其他格式，可以实现 `ExpressionVisitor`，遍历 `Expression` 节点并输出字符串或自定义结构。运行时求值器 `ExpressionEvaluatorImpl` 就是一个完整访问器示例。

### 增加运算符或语法

1. 在 `types.ts` 增加新的 `TokenKind`。
2. 在 `lexer.ts` 中识别新 token。
3. 在 `ast.ts` 增加对应 `Expression` 或 `BinaryOp` / `UnaryOp`，并设置优先级。
4. 在 `parser.ts` 的 `parseSingle` 或 `parseCompound` 中接入解析逻辑。
5. 在 `runtime.ts` 的 `ExpressionEvaluatorImpl` 中实现求值逻辑。

## 注意事项

- 标识符大小写不敏感，内部统一使用小写。
- 字符串沿用 Java 版行为，仅支持单引号字符串。
- 解析阶段依赖绑定，未注册的标识符会抛出 `ParseException`。
- `MolangFunction` 使用 `__molangFunction: true` 标记；请优先使用 `createMolangFunction` 创建函数。
