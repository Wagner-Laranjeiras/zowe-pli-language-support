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

/// <reference path="../../framework.ts" />

// @wrap: main
//// MAINPR: <|1:proc|> options( main );
////    b: <|2:proc|> returns( OPTIONAL byvalue fixed bin(31) );
////        return(32);
////    end b;
////    call b();
////    c: <|3:proc|>;
////        return(32);
////    end c;
////    call c();
////    d: <|4:proc|> returns( OPTIONAL byvalue fixed bin(31) );
////        return;
////    end d;
////    call d();
////    e: <|5:proc|> returns( OPTIONAL byvalue fixed bin(31) );
////    end e;
////    call e();
//// end MAINPR;

verify.noDiagnostics(1); // No RETURN, no RETURNS -> ok
verify.noDiagnostics(2); // Has RETURN, has RETURNS -> ok
verify.expectExclusiveErrorCodesAt(3, code.Error.IBM2412I.fullCode); // Has RETURN (...), has no RETURNS -> Need att
verify.expectExclusiveErrorCodesAt(4, code.Error.IBM2409I.fullCode); // Has RETURN, has RETURNS -> RETURN must return something
verify.expectExclusiveErrorCodesAt(5, code.Error.IBM2410I.fullCode); // Has no RETURN, has RETURNS -> must have RETURN (...)
