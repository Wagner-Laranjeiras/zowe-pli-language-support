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
import { collectNodesOfKind, findFirstNodeOfKind } from "../../../syntax-tree/ast-iterator";

/**
 * IBM2412I: If a procedure contains a RETURN statement, it should have the RETURNS attribute
 * specified on its PROCEDURE statement.
 *
 * @param node
 * @param acceptor
 * @returns
 */
export function IBM2412I_proc_with_return_stmt_needs_returns_att(
  node: AST.ProcedureStatement,
  acceptor: ValidationAcceptor,
): void {
  const hasReturnsAtt = node.options?.some(
    (att) => att.kind === AST.SyntaxKind.ReturnsOption,
  );
  if (hasReturnsAtt) return;

  const returnStmt = findFirstNodeOfKind(node, AST.SyntaxKind.ReturnStatement);
  if (!returnStmt) return;

  const token = node.procToken;
  if (!token) return;

  const errorRange = tokenToRange(token);
  const errorUri = tokenToUri(token);
  if (!errorRange || !errorUri) return;

  acceptor(Severity.E, PLICodes.Error.IBM2412I.message, {
    code: PLICodes.Error.IBM2412I.fullCode,
    range: errorRange,
    uri: errorUri,
  });
}

export function IBM2410I_functios_must_contain_at_least_one_return_stmt(
  node: AST.ProcedureStatement,
  acceptor: ValidationAcceptor,
) {

  const returnStmts = collectNodesOfKind(node, AST.SyntaxKind.ReturnStatement);
  if (returnStmts.length > 0) return;

  const token = node.procToken;
  if (!token) return;
  console.log('TOKEN IS HERE');
  const procName = token.image;
  
  if (!procName) return;
  console.log('PROC NAME: ', procName);
    console.log('token.immediateFollow: ', node);


  const errorRange = tokenToRange(token);
  const errorUri = tokenToUri(token);
  if (!errorRange || !errorUri) return;

  acceptor(Severity.E, PLICodes.Error.IBM2410I.message(procName), {
    code: PLICodes.Error.IBM2410I.fullCode,
    range: errorRange,
    uri: errorUri,
  });
}
