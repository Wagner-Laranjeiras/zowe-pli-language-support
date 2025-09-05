/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { ValidationAcceptor } from "../../validator";
import * as AST from "../../../syntax-tree/ast";
import {
  Severity,
  tokenToRange,
  tokenToUri,
} from "../../../language-server/types";
import * as PLICodes from "../pli-codes";
import {
  forEachNode,
  TraversalState,
  traverseAllNodes,
} from "../../../syntax-tree/ast-iterator";

/**
 * IBM2412I: If a procedure contains a RETURN statement, it should have the RETURNS attribute
 * specified on its PROCEDURE statement.
 *
 * IBM2409I: RETURN statement without an expression is invalid inside a nested PROCEDURE that
 * specifies the RETURNS attribute. All RETURN statements inside functions must specify a value
 * to be returned.
 *
 * IBM2410I: Functions must contain at least one RETURN statement.
 *
 * @param node The AST node being analyzed.
 * @param acceptor The mechanism used to collect validation issues.
 * @returns Validation results or diagnostics, as appropriate.
 */
export function IBM2409I_IBM2410I_IBM2412I_proc_needs_returns_att_and_valid_return_stmt(
  node: AST.ProcedureStatement,
  acceptor: ValidationAcceptor,
): void {
  const returnStmts: AST.ReturnStatement[] = [];

  const traverseChildren = (node: AST.SyntaxNode) => {
    traverseAllNodes(node, (n) => {
      if (n.kind === AST.SyntaxKind.ProcedureStatement)
        return TraversalState.Skip;
      if (n.kind === AST.SyntaxKind.ReturnStatement)
        returnStmts.push(n as AST.ReturnStatement);
      return TraversalState.Continue;
    });
  };
  forEachNode(node, (child) => {
    traverseChildren(child);
  });

  const hasReturnsAtt = node.options?.some(
    (att) => att.kind === AST.SyntaxKind.ReturnsOption,
  );

  if (returnStmts.length === 0 && !hasReturnsAtt) return;

  const returnSomething: AST.ReturnStatement[] = [];
  const returnNothing: AST.ReturnStatement[] = [];

  returnStmts?.forEach((ret: any) => {
    if (ret.expression) returnSomething.push(ret);
    if (!ret.expression) returnNothing.push(ret);
  });

  if (hasReturnsAtt && returnSomething.length > 0 && returnNothing.length === 0)
    return;

  // IBM2409I: All RETURN statements inside functions that specified the RETURNS attribute must specify a value to be returned.
  if (hasReturnsAtt && returnNothing.length > 0) {
    returnNothing.forEach((ret) => {
      const returnToken = ret.returnToken;
      if (!returnToken) return;

      const errorRange = tokenToRange(returnToken);
      const errorUri = tokenToUri(returnToken);
      if (!errorRange || !errorUri) return;

      acceptor(Severity.E, PLICodes.Error.IBM2409I.message, {
        code: PLICodes.Error.IBM2409I.fullCode,
        range: errorRange,
        uri: errorUri,
      });
    });

    return;
  }

  const procToken = node.procToken;
  if (!procToken) return;
  const errorRange = tokenToRange(procToken);
  const errorUri = tokenToUri(procToken);
  if (!errorRange || !errorUri) return;

  //IBM2410I: Procedures with RETURNS attribute must contain at least one RETURN statement.
  if (hasReturnsAtt && returnStmts.length === 0) {
    acceptor(Severity.E, PLICodes.Error.IBM2410I.message(procToken.image), {
      code: PLICodes.Error.IBM2410I.fullCode,
      range: errorRange,
      uri: errorUri,
    });
  }

  // IBM2412I: If a procedure contains a RETURN (...) statement, it should have the RETURNS attribute.
  if (returnSomething.length > 0 && !hasReturnsAtt) {
    acceptor(Severity.E, PLICodes.Error.IBM2412I.message, {
      code: PLICodes.Error.IBM2412I.fullCode,
      range: errorRange,
      uri: errorUri,
    });
  }
}
