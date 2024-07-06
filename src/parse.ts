import outdent from 'https://deno.land/x/outdent@v0.8.0/mod.ts';
import {error} from './main.ts';
import {Token, TokenType} from './scan.ts';

export enum NodeType {
  ASSERT,
  ASSIGN,
  CONST,
  DOT_ACCESS,
  EXPR,
  FUNCTION_CALL,
  FUNCTION,
  IF,
  LIST_LITERAL,
  MAIN,
  PARAMETER,
  PRINT,
  PROGRAM,
  REDUCE,
  RETURN,
  SPREAD,
  STATEMENT,
  STRUCT,
  TERMINAL_VALUE,
  THEOREM,
}

export type Node =
  | Program
  | Declaration
  | Statement
  | Statement['contents']
  | Parameter
  | Expr;

export interface NodeMixin<T extends NodeType> {
  type: T;
}

export interface Program extends NodeMixin<NodeType.PROGRAM> {
  declarations: Declaration[];
}

type Declaration = Function | Theorem | Const | Struct | Main;

interface Main extends NodeMixin<NodeType.MAIN> {
  body: Statement;
}

interface Function extends NodeMixin<NodeType.FUNCTION> {
  name: string;
  parameters: Parameter[];
  body: Statement;
}

interface Theorem extends NodeMixin<NodeType.THEOREM> {
  name: string;
  parameters: Parameter[];
  // What happens if you do `cw` in a theorem??
  body: Statement;
}

interface Const extends NodeMixin<NodeType.CONST> {
  name: string;
  value: Expr;
}

interface Struct extends NodeMixin<NodeType.STRUCT> {
  name: string;
  parameters: Parameter[];
}

export interface Parameter extends NodeMixin<NodeType.PARAMETER> {
  line: number;
  name: string;
  paramType: string;
}

export interface Statement extends NodeMixin<NodeType.STATEMENT> {
  contents: Print | Assign | Assert | Return | If;
  rest: Statement | null;
}

interface Print extends NodeMixin<NodeType.PRINT> {
  template: string;
  expressions: Expr[];
}

interface Return extends NodeMixin<NodeType.RETURN> {
  value: Expr;
}

interface Assign extends NodeMixin<NodeType.ASSIGN> {
  name: string;
  value: Expr;
}

interface Assert extends NodeMixin<NodeType.ASSERT> {
  value: Expr;
}

export interface If extends NodeMixin<NodeType.IF> {
  condition: Expr;
  body: Statement;
  rest: If | null;
  line: number;
}

type Expr =
  | DotAccess
  | TerminalValue
  | FunctionCall
  | ListLiteral
  | Spread
  | Reduce;

interface DotAccess extends NodeMixin<NodeType.DOT_ACCESS> {
  left: Expr;
  right: string;
}

interface TerminalValue extends NodeMixin<NodeType.TERMINAL_VALUE> {
  value: string;
}

interface FunctionCall extends NodeMixin<NodeType.FUNCTION_CALL> {
  name: string;
  args: Expr[];
}

interface ListLiteral extends NodeMixin<NodeType.LIST_LITERAL> {
  contents: Expr[];
}

interface Spread extends NodeMixin<NodeType.SPREAD> {
  value: Expr;
}

interface Reduce extends NodeMixin<NodeType.REDUCE> {
  parameters: Parameter[];
  body: Statement;
}

let hasMain = false;
export function parse(tokens: Token[]) {
  let current = 0;

  // program -> declaration* EOF
  function parseProgram(): Program {
    const declarations: Declaration[] = [];
    while (tokens[current].type !== TokenType.EOF) {
      declarations.push(parseDeclaration());
    }
    return {
      type: NodeType.PROGRAM,
      declarations,
    };
  }

  // declaration -> function | theorem | const | struct | main
  function parseDeclaration(): Declaration {
    if (tokens[current].type === TokenType.FUNCTION) {
      return parseFunction();
    } else if (tokens[current].type === TokenType.THEOREM) {
      return parseTheorem();
    } else if (tokens[current].type === TokenType.CONST) {
      return parseConst();
    } else if (tokens[current].type === TokenType.STRUCT) {
      return parseStruct();
    } else if (tokens[current].type === TokenType.MAIN) {
      return parseMain();
    } else {
      throw error(
        tokens[current].line,
        outdent`
          Expected a declaration, got ${TokenType[tokens[current].type]}
          Every top level expression must be a declaration. To have code
          that executes at the top level, introduce a 'main' declaration.
        `.trim()
      );
    }
  }

  // function -> 'function' IDENTIFIER '(' parameters* ')' '{' statement* '}'
  function parseFunction(): Function {
    expect(TokenType.FUNCTION);
    const name = expect(TokenType.IDENTIFIER).lexeme;
    expect(TokenType.LEFT_PAREN);
    const parameters = parseParameters();
    expect(TokenType.RIGHT_PAREN);
    expect(TokenType.LEFT_BRACE);
    const body = parseStatement();
    expect(TokenType.RIGHT_BRACE);
    return {
      type: NodeType.FUNCTION,
      name: name,
      parameters,
      body,
    };
  }

  // theorem -> 'theorem' IDENTIFIER '(' (parameters ',')* ')' '{' statement* '}'
  function parseTheorem(): Theorem {
    expect(TokenType.THEOREM);
    const name = expect(TokenType.IDENTIFIER).lexeme;
    expect(TokenType.LEFT_PAREN);
    const parameters = parseParameters();
    expect(TokenType.RIGHT_PAREN);
    expect(TokenType.LEFT_BRACE);
    const body = parseStatement();
    expect(TokenType.RIGHT_BRACE);
    return {
      type: NodeType.THEOREM,
      name,
      parameters,
      body,
    };
  }

  // const -> 'const' IDENTIFIER '=' expr ';'
  function parseConst(): Const {
    expect(TokenType.CONST);
    const name = expect(TokenType.IDENTIFIER).lexeme;
    if (!name.startsWith('*') && !name.endsWith('*')) {
      throw error(
        tokens[current].line,
        `Const names must begin and end with '*', *like-this*, got ${name} instead`
      );
    }
    expect(TokenType.EQUAL);
    const value = parseExpr();
    expect(TokenType.SEMICOLON);
    return {
      type: NodeType.CONST,
      name,
      value,
    };
  }

  function parseStruct(): Struct {
    expect(TokenType.STRUCT);
    const name = expect(TokenType.IDENTIFIER).lexeme;
    expect(TokenType.LEFT_PAREN);
    const parameters = parseParameters();
    expect(TokenType.RIGHT_PAREN);
    expect(TokenType.SEMICOLON);
    return {
      type: NodeType.STRUCT,
      name,
      parameters,
    };
  }

  function parseParameters() {
    const parameters: Parameter[] = [];
    if (tokens[current].type != TokenType.RIGHT_PAREN) {
      while (true) {
        if (tokens[current].type == TokenType.RIGHT_PAREN) break;
        parameters.push(parseParameter());
        if (tokens[current].type === TokenType.COMMA) {
          expect(TokenType.COMMA);
        } else {
          break;
        }
      }
    }
    return parameters;
  }

  // parameter -> IDENTIFIER ':' type
  function parseParameter(): Parameter {
    const {lexeme: name, line} = expect(TokenType.IDENTIFIER);
    expect(TokenType.COLON);
    const paramType = parseType();
    return {type: NodeType.PARAMETER, line, name, paramType};
  }

  // type -> IDENTIFIER
  function parseType(): string {
    return expect(TokenType.IDENTIFIER).lexeme;
  }

  // statement -> print | assign | return
  function parseStatement(): Statement {
    let contents: Statement['contents'];
    switch (tokens[current].type) {
      case TokenType.PRINT:
        contents = parsePrint();
        break;
      case TokenType.ASSERT:
        contents = parseAssert();
        break;
      case TokenType.IDENTIFIER:
        contents = parseAssign();
        break;
      case TokenType.RETURN:
        contents = parseReturn();
        break;
      case TokenType.IF:
        contents = parseIf();
        break;
      default:
        throw error(
          tokens[current].line,
          `Expected a statement but got ${TokenType[tokens[current].type]}`
        );
    }
    let rest;
    if (tokens[current].type === TokenType.RIGHT_BRACE) {
      rest = null;
    } else {
      rest = parseStatement();
    }
    return {
      type: NodeType.STATEMENT,
      contents,
      rest,
    };
  }

  // print -> 'print' '(' template expr* ')' ';'
  function parsePrint(): Print {
    expect(TokenType.PRINT);
    expect(TokenType.LEFT_PAREN);
    const template = expect(TokenType.STRING).lexeme;
    let expressions: Expr[];
    if (tokens[current].type === TokenType.RIGHT_PAREN) {
      expressions = [];
    } else {
      expect(TokenType.COMMA);
      expressions = parseExpressions();
    }
    expect(TokenType.RIGHT_PAREN);
    expect(TokenType.SEMICOLON);
    return {
      type: NodeType.PRINT,
      template,
      expressions,
    };
  }

  // assert -> 'assert' '(' expr ')' ';'
  function parseAssert(): Assert {
    expect(TokenType.ASSERT);
    expect(TokenType.LEFT_PAREN);
    const value = parseExpr();
    expect(TokenType.RIGHT_PAREN);
    expect(TokenType.SEMICOLON);
    return {
      type: NodeType.ASSERT,
      value,
    };
  }

  // return -> 'return' expr ';'
  function parseReturn(): Return {
    expect(TokenType.RETURN);
    const value = parseExpr();
    expect(TokenType.SEMICOLON);
    return {
      type: NodeType.RETURN,
      value,
    };
  }

  // assign -> IDENTIFIER '=' expr ';'
  function parseAssign(): Assign {
    // TODO: support foo.x as an lvalue
    const name = expect(TokenType.IDENTIFIER).lexeme;
    expect(TokenType.EQUAL);
    const value = parseExpr();
    expect(TokenType.SEMICOLON);
    return {
      type: NodeType.ASSIGN,
      name,
      value,
    };
  }

  function parseMain(): Main {
    if (hasMain) {
      throw error(tokens[current].line, 'Only one main declaration is allowed');
    }
    hasMain = true;
    expect(TokenType.MAIN);
    expect(TokenType.LEFT_BRACE);
    const body = parseStatement();
    expect(TokenType.RIGHT_BRACE);
    return {
      type: NodeType.MAIN,
      body,
    };
  }

  function parseIf(): If {
    let condition;
    const line = tokens[current].line;
    if (tokens[current].type === TokenType.IF) {
      expect(TokenType.IF);
      expect(TokenType.LEFT_PAREN);
      condition = parseExpr();
      expect(TokenType.RIGHT_PAREN);
    } else {
      condition = {
        type: NodeType.TERMINAL_VALUE,
        value: 'true',
      } as const;
    }
    expect(TokenType.LEFT_BRACE);
    const body = parseStatement();
    expect(TokenType.RIGHT_BRACE);
    let rest = null;
    if (tokens[current].type === TokenType.ELSE) {
      expect(TokenType.ELSE);
      rest = parseIf();
    }
    return {
      type: NodeType.IF,
      condition,
      body,
      rest,
      line,
    };
  }

  function parseExpressions() {
    const expressions: Expr[] = [];
    while (
      tokens[current].type !== TokenType.RIGHT_PAREN &&
      tokens[current].type !== TokenType.RIGHT_BRACKET
    ) {
      expressions.push(parseExpr());
      if (tokens[current].type === TokenType.COMMA) {
        expect(TokenType.COMMA);
      } else {
        break;
      }
    }
    return expressions;
  }

  function parseExpr(level = 0): Expr {
    // '(' expr ')'
    if (tokens[current].type === TokenType.LEFT_PAREN) {
      const inside = parseExpr();
      expect(TokenType.RIGHT_PAREN);
      return inside;
    }
    // '[' expr* ']'
    if (tokens[current].type === TokenType.LEFT_BRACKET) {
      const contents = parseExpressions();
      expect(TokenType.RIGHT_BRACKET);
      return {
        type: NodeType.LIST_LITERAL,
        contents,
      };
    }
    // Reducers
    if (tokens[current].type === TokenType.REDUCE) {
      expect(TokenType.REDUCE);
      expect(TokenType.LEFT_PAREN);
      const parameters = parseParameters();
      expect(TokenType.RIGHT_PAREN);
      expect(TokenType.LEFT_BRACE);
      const body = parseStatement();
      expect(TokenType.RIGHT_BRACE);
      return {
        type: NodeType.REDUCE,
        parameters,
        body,
      };
    }
    // Unary expressions
    if (tokens[current].type === TokenType.BANG) {
      expect(TokenType.BANG);
      const right = parseExpr();
      return {
        type: NodeType.FUNCTION_CALL,
        name: 'not',
        args: [right],
      };
    }
    if (tokens[current].type === TokenType.MINUS) {
      expect(TokenType.MINUS);
      const right = parseExpr();
      return {
        type: NodeType.FUNCTION_CALL,
        name: '-',
        args: [right],
      };
    }
    if (tokens[current].type === TokenType.DOT_DOT_DOT) {
      expect(TokenType.DOT_DOT_DOT);
      const right = parseExpr();
      return {
        type: NodeType.SPREAD,
        value: right,
      };
    }
    if (tokens[current].type === TokenType.NEW) {
      expect(TokenType.NEW);
      const right = parseExpr();
      if (right.type !== NodeType.FUNCTION_CALL) {
        throw error(
          tokens[current].line,
          'New expressions must be function calls'
        );
      }
      return right;
    }
    // Binary expressions
    switch (level) {
      case 0: {
        const left = parseExpr(level + 1);
        if (tokens[current].type === TokenType.DOT) {
          expect(TokenType.DOT);
          const right = expect(TokenType.IDENTIFIER).lexeme;
          return {
            type: NodeType.DOT_ACCESS,
            left,
            right,
          };
        }
        return left;
      }
      case 1: {
        const left = parseExpr(level + 1);
        if ([TokenType.STAR, TokenType.SLASH].includes(tokens[current].type)) {
          const op = tokens[current];
          expect(op.type);
          const right = parseExpr(level);
          return {
            type: NodeType.FUNCTION_CALL,
            name: op.lexeme,
            args: [left, right],
          };
        }
        return left;
      }
      case 2: {
        const left = parseExpr(level + 1);
        if ([TokenType.PLUS, TokenType.MINUS].includes(tokens[current].type)) {
          const op = tokens[current];
          expect(op.type);
          const right = parseExpr(level);
          return {
            type: NodeType.FUNCTION_CALL,
            name: op.lexeme,
            args: [left, right],
          };
        }
        return left;
      }
      case 3: {
        const left = parseExpr(level + 1);
        if (
          [
            TokenType.GREATER,
            TokenType.GREATER_EQUAL,
            TokenType.LESS,
            TokenType.LESS_EQUAL,
            TokenType.EQUAL_EQUAL,
            TokenType.BANG_EQUAL,
          ].includes(tokens[current].type)
        ) {
          const op = tokens[current];
          expect(op.type);
          const right = parseExpr(level);
          return {
            type: NodeType.FUNCTION_CALL,
            name: op.lexeme,
            args: [left, right],
          };
        }
        return left;
      }
      case 4:
        if (tokens[current].type === TokenType.IDENTIFIER) {
          const {lexeme} = expect(TokenType.IDENTIFIER);
          if (tokens[current].type === TokenType.LEFT_PAREN) {
            expect(TokenType.LEFT_PAREN);
            const args = parseExpressions();
            expect(TokenType.RIGHT_PAREN);
            return {
              type: NodeType.FUNCTION_CALL,
              name: lexeme,
              args,
            };
          }
          return {
            type: NodeType.TERMINAL_VALUE,
            value: lexeme,
          };
        } else {
          return {
            type: NodeType.TERMINAL_VALUE,
            value: parseLiteral(),
          };
        }
    }
    throw new Error('Unreachable code');
  }

  function parseLiteral() {
    switch (tokens[current].type) {
      case TokenType.NUMBER:
        return expect(TokenType.NUMBER).lexeme;
      case TokenType.STRING:
        return expect(TokenType.STRING).lexeme;
      case TokenType.TRUE:
        return expect(TokenType.TRUE).lexeme;
      case TokenType.FALSE:
        return expect(TokenType.FALSE).lexeme;
      case TokenType.NIL:
        return expect(TokenType.NIL).lexeme;
      default:
        throw error(
          tokens[current].line,
          `Unexpected token ${TokenType[tokens[current].type]}`
        );
    }
  }

  function expect(...types: TokenType[]): Token {
    if (types.includes(tokens[current].type)) {
      const token = tokens[current];
      current++;
      return token;
    }
    throw error(
      tokens[current].line,
      `Expected ${types.map(tt => TokenType[tt]).join(', ')} but found ${TokenType[tokens[current].type]}`
    );
  }

  return parseProgram();
}
