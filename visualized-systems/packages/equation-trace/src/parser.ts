import type { MathNode } from './evaluator.ts';

export interface Token {
  type: 'NUMBER' | 'IDENT' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'CARET' | 'LPAREN' | 'RPAREN' | 'EQUALS' | 'EOF';
  value: string;
  pos: number;
}

export interface ParsedEquationLine {
  sourceLine: number;
  rawText: string;
  functionName: string;
  parameterName: string;
  expressionText: string;
  ast: MathNode;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Comments (# or //)
    if (ch === '#' || (ch === '/' && input[i + 1] === '/')) {
      break;
    }

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '+') {
      tokens.push({ type: 'PLUS', value: '+', pos: i++ });
      continue;
    }
    if (ch === '-') {
      tokens.push({ type: 'MINUS', value: '-', pos: i++ });
      continue;
    }
    if (ch === '*') {
      tokens.push({ type: 'STAR', value: '*', pos: i++ });
      continue;
    }
    if (ch === '/') {
      tokens.push({ type: 'SLASH', value: '/', pos: i++ });
      continue;
    }
    if (ch === '^') {
      tokens.push({ type: 'CARET', value: '^', pos: i++ });
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i++ });
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i++ });
      continue;
    }
    if (ch === '=') {
      tokens.push({ type: 'EQUALS', value: '=', pos: i++ });
      continue;
    }

    // Numbers (e.g. 12, 3.14, .5)
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(input[i + 1] || ''))) {
      const start = i;
      let hasDot = ch === '.';
      i++;
      while (i < input.length) {
        const c = input[i];
        if (/\d/.test(c)) {
          i++;
        } else if (c === '.' && !hasDot) {
          hasDot = true;
          i++;
        } else {
          break;
        }
      }
      tokens.push({ type: 'NUMBER', value: input.slice(start, i), pos: start });
      continue;
    }

    // Identifiers (letters, e.g. x, f, sin)
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        i++;
      }
      tokens.push({ type: 'IDENT', value: input.slice(start, i), pos: start });
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at index ${i}`);
  }

  tokens.push({ type: 'EOF', value: '', pos: i });
  return tokens;
}

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', pos: 0 };
  }

  private advance(): Token {
    const token = this.peek();
    if (token.type !== 'EOF') {
      this.current++;
    }
    return token;
  }

  private match(type: Token['type']): boolean {
    if (this.peek().type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  public parseExpression(): MathNode {
    return this.parseBinary(1);
  }

  // Precedence climbing
  // 1: +, -
  // 2: *, /
  // 3: unary (+, -)
  // 4: ^
  private parseBinary(minPrec: number): MathNode {
    let left = this.parseUnary();

    while (true) {
      // Check for implicit multiplication:
      // If next token can start an expression (NUMBER, IDENT, LPAREN) and is NOT an operator
      if (this.canStartImplicitMul()) {
        const prec = 2; // Multiplication precedence
        if (prec >= minPrec) {
          const right = this.parseBinary(prec + 1);
          left = { type: 'binary', op: '*', left, right };
          continue;
        }
      }

      const tok = this.peek();
      let prec = 0;
      let rightAssoc = false;

      if (tok.type === 'PLUS' || tok.type === 'MINUS') {
        prec = 1;
      } else if (tok.type === 'STAR' || tok.type === 'SLASH') {
        prec = 2;
      } else if (tok.type === 'CARET') {
        prec = 4;
        rightAssoc = true;
      }

      if (prec < minPrec) {
        break;
      }

      this.advance();
      const nextMinPrec = rightAssoc ? prec : prec + 1;
      const right = this.parseBinary(nextMinPrec);

      left = {
        type: 'binary',
        op: tok.value as '+' | '-' | '*' | '/' | '^',
        left,
        right,
      };
    }

    return left;
  }

  private canStartImplicitMul(): boolean {
    const tok = this.peek();
    if (tok.type === 'NUMBER' || tok.type === 'IDENT' || tok.type === 'LPAREN') {
      return true;
    }
    return false;
  }

  private parseUnary(): MathNode {
    const tok = this.peek();
    if (tok.type === 'MINUS' || tok.type === 'PLUS') {
      this.advance();
      const expr = this.parseBinary(3); // Unary precedence
      return { type: 'unary', op: tok.value as '-' | '+', expr };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): MathNode {
    const tok = this.peek();

    if (tok.type === 'NUMBER') {
      this.advance();
      return { type: 'number', value: parseFloat(tok.value) };
    }

    if (tok.type === 'IDENT') {
      this.advance();
      const name = tok.value;

      // Function call if followed by LPAREN, unless name is the variable name (e.g. x(t) isn't variable x)
      if (this.match('LPAREN')) {
        const arg = this.parseExpression();
        if (!this.match('RPAREN')) {
          throw new Error(`Expected ')' after argument to function ${name}`);
        }
        return { type: 'call', name, arg };
      }

      // Variable or constant
      if (name.toLowerCase() === 'pi') {
        return { type: 'number', value: Math.PI };
      }
      if (name.toLowerCase() === 'e') {
        return { type: 'number', value: Math.E };
      }

      return { type: 'variable', name };
    }

    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      if (!this.match('RPAREN')) {
        throw new Error("Expected ')' matching '('");
      }
      return expr;
    }

    throw new Error(`Unexpected token '${tok.value || tok.type}' at position ${tok.pos}`);
  }
}

export function parseEquationLine(
  line: string,
  lineNumber: number,
  defaultVar = 'x',
  fallbackFnPrefix = 'f'
): ParsedEquationLine | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return null;
  }

  const tokens = tokenize(trimmed);
  if (tokens.length <= 1) {
    return null;
  }

  // Check if this line is an assignment:
  // e.g. f(x) = ...
  // or y = ...
  let fnName = `${fallbackFnPrefix}_${lineNumber}`;
  let paramName = defaultVar;
  let exprStartIndex = 0;

  // Pattern 1: IDENT LPAREN IDENT RPAREN EQUALS ...
  if (
    tokens.length > 5 &&
    tokens[0].type === 'IDENT' &&
    tokens[1].type === 'LPAREN' &&
    tokens[2].type === 'IDENT' &&
    tokens[3].type === 'RPAREN' &&
    tokens[4].type === 'EQUALS'
  ) {
    fnName = tokens[0].value;
    paramName = tokens[2].value;
    exprStartIndex = 5;
  }
  // Pattern 2: IDENT EQUALS ...
  else if (tokens.length > 2 && tokens[0].type === 'IDENT' && tokens[1].type === 'EQUALS') {
    fnName = tokens[0].value;
    exprStartIndex = 2;
  }

  const exprTokens = tokens.slice(exprStartIndex);
  const parser = new Parser(exprTokens);
  const ast = parser.parseExpression();

  const equalsIdx = trimmed.indexOf('=');
  const expressionText = equalsIdx !== -1 ? trimmed.slice(equalsIdx + 1).trim() : trimmed;

  return {
    sourceLine: lineNumber,
    rawText: trimmed,
    functionName: fnName,
    parameterName: paramName,
    expressionText,
    ast,
  };
}
