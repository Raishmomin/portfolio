// The world's land, for the contact globe: Natural Earth 1:110m land polygons (public
// domain; via world-atlas@2.0.2 land-110m.json) rasterised to a 360 × 180 equirectangular
// bitmask (1° cells; row 0 = 90°N, column 0 = 180°W), run-length encoded. Each row lists
// alternating run lengths, water first, in a 63-letter alphabet ("_" adds 63) and ends
// with "."; a trailing water run is implied. Decoded once into an R8 texture that the
// globe's dot grid samples (scenes/contact/shaders.ts).
export const LAND_W = 360;
export const LAND_H = 180;

const ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-";
const RLE =
  "......__FC._V21LFP._QP4d29._L76D3pZ213M4f6._ML8lU824_57._435513341D2rW7_I5.z341G16A9oX441_H2.w48273252A9n_N4WB._071353221615Md_E6RON8._32M611Pb_D3RO.u8924415232213MZ_C3OW1544D3.t6191335124931MX_B4D48mA6.01t41E53133G11HX_B4C4121r31221D.JAbB743KET21l7a61_N.HO4F3E3414545AD21RgFR4361_V28.01Cr6371362567GOiME23A251_g.04C_D164229ALlR322P2_g.0513612_G9C9ImK263S1_i.174_I11B632ADH9QA3A5__E.61813_A244318EBJ7QA3B2__F.829_7522197EAoB2__V.F_A824173H7nC3__U11.E_9G6N6mC4__A2329.FH2qG8O3mD4__779.I822AjH932_6D721_w2453.N3GjFA14w293267_sI3.M213IfGFu4C115511_rH6.K2QiBFu3B3145_sI7.H2Tk8Is4A2137_qJ7.F1Xn2Nm323A1631_sJ5.l13l3Nl3337__811D4.qk3Nl2362__B11D2.qm1M11p53__B11E1.q11_331p24__E12.r21v324211q__G22.vs1366m__J21.u11v9111o__G31.ux1121wX133C3_M42.u_0yE1G322B5_L.uu22_0D3E993_N61.us-339342CC83_L64.ur-C834AE65_F94.ur-BA43945485_D.uo_2A725315212L3_517B2.uo_298261333N4_33123C2.vm_39L33M5_173C1.vl_48E2624N4_2124393.wk_716AB162122_M5375.xj_713DP_L7248.yh_7HQ_L614312.-d_8JO_N94._0b_8O62C_N92._021X_8Q47314_O81._112W_8T1_c._212H4262_8g1F2_9._311GD2_7j1D3_8._231EE3_4k3D4_5._413CF211_1m2E7_0._512CG1_2o2D117y._513A_Ko2E33Aq21._A9_Jq3K9n31._B8E113_0q3LAL1N51._C8I2ys2KBH5G12._B973A2xr3JEE6E.O1o954E3sr4HFC9C32._D925E611os3GGBAC31._GD_9t3DIABDD2._IB_8u4AK9CEC2._O9_4v39M6IBB2._P9_3w26P6IBB2._R6_4x14S5IBD2._U4_3yW5I227F1._V2B1ux62P4J136D121._V3741523kx16P4I153C1._X221341Al_2P311H161C161._X42Il_0R121H2N111._a12Jk_0U2H1M113._eJlyV2I2E261._dPhA5ip3D3._ePi1Dgm232B5._eQzbo222A4._cSzaq22277._cTxas31159A1._bUxYu4692441._bVwXw459E1._aasXx3672393._aa11rVy54723B124._bfoT-482311141312A._ahnS_13G1D9._aklR_22G1B1382112._aklR_43P13A71._bjmQ_56P9B1._cimQ_C122111131D332._chnR_G141M2B2._dgnR_l1._eepQ_T191._edpS81_I651._fbqS81_H662._fbpT72_D21763._gapS73_BC63._iYpS46_BE35L1B1._kWpQ65_AI15W1._lUqO85_AO._lUrM95_9Q._lUrM95_6VF1._lTtL85_4YG1._lSuM75_3a._lPxL94_3b._kO-K93_3d._kN_0IC1_5d._kM_1I_He._kM_1I_Id._kM_2G_Kd._kL_4E_Lc._jM_4E_Lc._jL_6C_Nb._kJ_7B_OA8I._jJ_89_P9B21D._jE13_A2_W3G11E._iG___6CN1._iG___8AO1._hH___8AP1._iE___D112S3._iB___l3._hC___m2._h9___L3O211._hB___J3N3._i8___M1N3._h9___i3._g8___j4._g8___k2._g9._f9._f8__B1._g6._g683._h4._h6._j6._m1........_w2._t1._r1___91._o3_q6i464F6._n3_oCM_1._n3_jQA_8._j225_W62U7_I._j316_542A2i5_P._g716o22_C4_a._o6m__w.r222I53A435Cj__x.iA132711Acl__u.Y_Ik__v.Y_Dg___3.M_Kh___7.G34_GT58___E.I3A_9Q8D___2.X_B7668G___1.P_RO___D.R_V4___U.Q_____8.0517K_____A.V1.....";

/** Land mask, LAND_W × LAND_H bytes (255 = land), row-major from the north. */
export function decodeLand(): Uint8Array {
  const out = new Uint8Array(LAND_W * LAND_H);
  let row = 0;
  let col = 0;
  let land = false;
  let acc = 0;
  for (let i = 0; i < RLE.length && row < LAND_H; i++) {
    const ch = RLE[i];
    if (ch === ".") {
      row++;
      col = 0;
      land = false;
      acc = 0;
      continue;
    }
    if (ch === "_") {
      acc += 63;
      continue;
    }
    const run = acc + ALPHA.indexOf(ch);
    acc = 0;
    if (land) out.fill(255, row * LAND_W + col, row * LAND_W + Math.min(LAND_W, col + run));
    col += run;
    land = !land;
  }
  return out;
}
