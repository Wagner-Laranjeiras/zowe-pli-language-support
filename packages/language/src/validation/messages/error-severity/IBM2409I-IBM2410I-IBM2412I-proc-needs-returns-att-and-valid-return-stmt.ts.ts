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
import { collectNodesOfKind } from "../../../syntax-tree/ast-iterator";

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
  const returnStmts = collectNodesOfKind(node, AST.SyntaxKind.ReturnStatement);
  const hasReturnsAtt = node.options?.some(
    (att) => att.kind === AST.SyntaxKind.ReturnsOption,
  );

  // IBM2409I: All RETURN statements inside functions that specified the RETURNS attribute must specify a value to be returned.
  if (hasReturnsAtt && returnStmts.length > 0) {
    returnStmts.forEach((ret) => {
      if (ret.kind !== AST.SyntaxKind.ReturnStatement) return;
      if (ret.expression) return;

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

  const token = node.procToken;
  if (!token) return;
  const errorRange = tokenToRange(token);
  const errorUri = tokenToUri(token);
  if (!errorRange || !errorUri) return;

  //IBM2410I: Functions must contain at least one RETURN statement.
  if (returnStmts.length === 0) {
    acceptor(Severity.E, PLICodes.Error.IBM2410I.message(token.image), {
      code: PLICodes.Error.IBM2410I.fullCode,
      range: errorRange,
      uri: errorUri,
    });
  }

  // IBM2412I: If a procedure contains a RETURN statement, it should have the RETURNS attribute.
  if (returnStmts.length > 0 && !hasReturnsAtt) {
    acceptor(Severity.E, PLICodes.Error.IBM2412I.message, {
      code: PLICodes.Error.IBM2412I.fullCode,
      range: errorRange,
      uri: errorUri,
    });
  }
}
