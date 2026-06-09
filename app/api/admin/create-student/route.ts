import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  let createdUserId: string | null = null

  try {
    const formData = await request.formData()

    const fullName = formData.get("fullName") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const phone = formData.get("phone") as string
    const cohortId = formData.get("cohortId") as string
    const profileImage = formData.get("profileImage") as File | null

    if (!fullName || !email || !password || !cohortId) {
      return NextResponse.json(
        {
          error: "Full name, email, password, and cohort are required.",
        },
        { status: 400 }
      )
    }

    const { data: cohortData, error: cohortError } = await supabaseAdmin
      .from("cohorts")
      .select("id, cohort_code")
      .eq("id", cohortId)
      .single()

    if (cohortError || !cohortData) {
      return NextResponse.json(
        { error: "Selected cohort not found." },
        { status: 400 }
      )
    }

    const cohortCode = cohortData.cohort_code || "COH"

    const { count, error: countError } = await supabaseAdmin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("cohort_id", cohortId)

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 400 }
      )
    }

    const nextStudentNumber = String((count || 0) + 1).padStart(3, "0")
    const studentCode = `${cohortCode}-S${nextStudentNumber}`

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "student",
        },
      })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create student user." },
        { status: 400 }
      )
    }

    const userId = authData.user.id
    createdUserId = userId

    let profilePictureUrl: string | null = null

    if (profileImage && profileImage.size > 0) {
      const fileExt = profileImage.name.split(".").pop()
      const filePath = `${userId}/profile.${fileExt}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from("student-profiles")
        .upload(filePath, profileImage, {
          upsert: true,
          contentType: profileImage.type,
        })

      if (uploadError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)

        return NextResponse.json(
          { error: uploadError.message },
          { status: 400 }
        )
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("student-profiles")
        .getPublicUrl(filePath)

      profilePictureUrl = publicUrlData.publicUrl

      const { error: profileAvatarError } = await supabaseAdmin
        .from("profiles")
        .update({
          avatar_url: profilePictureUrl,
        })
        .eq("id", userId)

      if (profileAvatarError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)

        return NextResponse.json(
          { error: profileAvatarError.message },
          { status: 400 }
        )
      }
    }

    const { error: studentError } = await supabaseAdmin.from("students").insert({
      profile_id: userId,
      cohort_id: cohortId,
      student_code: studentCode,
      phone: phone || null,
      status: "active",
      joining_date: new Date().toISOString().split("T")[0],
      profile_picture_url: profilePictureUrl,
    })

    if (studentError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)

      return NextResponse.json(
        { error: studentError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Student created successfully.",
      studentCode,
    })
  } catch {
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId)
    }

    return NextResponse.json(
      { error: "Something went wrong while creating student." },
      { status: 500 }
    )
  }
}