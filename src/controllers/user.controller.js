import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import fs from "fs"
import jwt from "jsonwebtoken"


const registerUser = asyncHandler( async (req,res) => {
    // get user details from frontend
    // validation - not empty
    //check if user already exist: username ,email
    // check for images ,check for avatar
    // upload them on cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token from field from response
    // check for user creation 
    // return response


    const {fullName,email,username,password} = req.body
    // console.log(email)

    // if(fullName ===""){
    //     throw new ApiError(400,"fullname is required")
    // }
    if(
        [fullName,email,username,password].some((field)=> field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser = await User.findOne({
        $or : [ {username},{email}]
    })

    
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(existedUser){
        if (avatarLocalPath) fs.unlinkSync(avatarLocalPath);
        if (coverImageLocalPath) fs.unlinkSync(coverImageLocalPath);
        throw new ApiError(409,"User with email or username already exist")
    }


    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser){
        throw new ApiError(500,"something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )
})

const loginUser = asyncHandler(async (req,res) => {
    // get username and password from frontend req body --> data
    // username or email
    // find the user in db
    // password check
    // generate access and refresh token
    // send cookies
    // send response
    
    const {username,password,email} = req.body
    if(!(username || email)){
        throw new ApiError(400,"username or email is required")
    }

    const user =await User.findOne({
        $or:[
            {username},
            {email}
        ]
    }
    )

    if(!user){
        throw new ApiError (404,"User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"invalid credentias")
    }

    const generateAccessAndRefreshToken = async (userId) =>{
        try {
            console.log("Fetching user for token generation...");
            const user = await User.findById(userId)

            console.log("Generating tokens...");
            const accessToken = user.generateAccessToken()
            const refreshToken = user.generateRefreshToken()

            console.log("Saving refresh token...");
            user.refreshToken = refreshToken
            await user.save({validateBeforeSave:false})

            console.log("Tokens generated successfully.")
            return {accessToken,refreshToken}
        } catch (error) {
            console.error("Error while generating tokens:", error);
            throw new ApiError(500,"something went wrong while generating tokens")
        }
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options ={
        httpOnly: true,
        secure: true,
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(200,
        {
            user:loggedInUser,
            accessToken,
            refreshToken
        },"User logged in successfully"))
})

const logoutUser = asyncHandler(async (req,res)=>{
    // create middleware for req.user
    // get user from req.user
    // remove refresh token from user
    // send response
    User.findByIdAndUpdate(req.user._id,{
        $set:{
            refreshToken:undefined
        }
    },
   {
    new:true,
})
    const options={
        httpOnly:true,
        secure:true,
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out successfully"))
})


const refreshAccessToken = asyncHandler(async (req,res)=>{
    // get refresh token from  cookies
    // verify the token
    // generate new access and refresh token
    // send new tokens in cookies
    // send response
    try {
        const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    
        if(!incomingRefreshToken){
            throw new ApiError(401,"Unauthorized request")
        }
    
        const decodedToken  = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await  User.findById(decodedToken._id)
    
        if (!user){
            throw new ApiError(401,"invalid refresh token")
        }
    
        if(user.refreshToken !== incomingRefreshToken){
            throw new ApiError(401,"refresh token is expired or used")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(200,{ accessToken,newRefreshToken},"Access token refreshed successfully"))
    } catch (error) {
        throw new ApiError(401,"invalid refresh token or unauthorized request")
    }
})

const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword,newPassword} = req.body
   
    const user = await User.findById(req.user._id)

    if(!user){
        throw new ApiError(404,"invalid credentials")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401,"invalid credentials")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{user},"Password changed successfully"))
})

const getCurrentUser = asyncHandler (async (req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"user fetched successfully"))
})

const updateAccountDetails = asyncHandler( async (req,res)=>{
    const {fullName,email} = req.body

    if(!fullName && !email){
        throw new ApiError(400,"All fields are required")
    }

   const user = await User.findByIdAndUpdate( req.user?._id,
    {
        $set:{
            fullName,// fullName:fullName
            email,// email:email
        }
    },
    { new:true}
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req,res)=>{
    const avatarLocalPath =req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,

        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    if(!user){
        throw new ApiError(500,"something went wrong while updating avatar")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler(async (req,res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover image file is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    if(!user){
        throw new ApiError(500,"something went wrong while updating cover image")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Cover image updated successfully"))
})

export {registerUser
    ,loginUser
    ,logoutUser
    ,refreshAccessToken
    ,changeCurrentPassword
    ,getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}
