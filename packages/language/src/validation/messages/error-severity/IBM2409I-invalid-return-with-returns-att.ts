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
import * as PLICodes from "./../pli-codes";
import { collectNodesOfKind } from "../../../syntax-tree/ast-iterator";

/**
 * IBM2409I: RETURN statement without an expression is invalid inside a nested PROCEDURE that 
 * specified the RETURNS attribute. All RETURN statements inside functions must specify a value 
 * to be returned.
 * 
 * @param node 
 * @param acceptor 
 * @returns
 */
export function IBM2409I_invalid_return_with_returns_att(
  node: AST.ProcedureStatement,
  acceptor: ValidationAcceptor,
): void {
  const hasReturnsAtt = node.options?.some(
    (att) => att.kind === AST.SyntaxKind.ReturnsOption,
  );
  if (!hasReturnsAtt) return;

  const returnStmts = collectNodesOfKind(node, AST.SyntaxKind.ReturnStatement);
  if (returnStmts.length === 0) return;

  returnStmts.forEach((ret) => {
    if (ret.kind !== AST.SyntaxKind.ReturnStatement) return;
    if (ret.expression) return;

    const token = ret.returnToken;
    if (!token) return;

    const errorRange = tokenToRange(token);
    const errorUri = tokenToUri(token);
    if (!errorRange || !errorUri) return;

    acceptor(Severity.E, PLICodes.Error.IBM2409I.message, {
      code: PLICodes.Error.IBM2409I.fullCode,
      range: errorRange,
      uri: errorUri,
    });
  });
}
